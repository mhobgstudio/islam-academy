#!/usr/bin/env bash
#
# ISLAM ACADEMY — start the local server.
#
#   ./start.sh              serve on port 8777 in the foreground
#   ./start.sh --port 9000  pick a port
#   ./start.sh --daemon     run in the background, write a pid file
#   ./start.sh --detach     background + open a browser + tail the log
#   ./start.sh --stop       stop a backgrounded instance (same as ./stop.sh)
#   ./start.sh --status     report whether it is running
#   ./start.sh --check      validate the data and run the headless smoke test
#
# The academy is static: no build step, no dependencies. It does need to be
# served over HTTP, because the browser blocks fetch() of the data files from
# a file:// page.
set -uo pipefail

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

RUN_DIR="$DIR/.run"
PID_FILE="$RUN_DIR/server.pid"
LOG_FILE="$DIR/.smoke/server.log"
PORT_FILE="$RUN_DIR/port"

# Keep generated runtime state out of git.
mkdir -p "$RUN_DIR" "$(dirname "$LOG_FILE")"
if ! grep -qxF '.run/' .gitignore 2>/dev/null; then
  printf '\n# runtime state written by start.sh\n.run/\n' >> .gitignore
fi
if ! grep -qxF '.smoke/' .gitignore 2>/dev/null; then
  printf '# headless smoke-test screenshots\n.smoke/\n' >> .gitignore
fi

DEFAULT_PORT=8777
PORT="$DEFAULT_PORT"
DAEMON=0
OPEN_BROWSER=0

die()  { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }

# --- pick a python that can serve -------------------------------------------
PYTHON=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PYTHON="$c"; break; fi
done
[ -n "$PYTHON" ] || die "python3 is required but was not found on PATH."

# --- the port must actually be free -----------------------------------------
port_in_use() {
  # Works without lsof/ss by letting the OS tell us.
  "$PYTHON" - "$1" <<'PYEOF' 2>/dev/null
import socket, sys
s = socket.socket()
s.settimeout(0.4)
sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)
PYEOF
}

# The command line of a pid, without depending on Linux-only /proc.
proc_cmdline() {
  local pid="$1"
  if [ -r "/proc/$pid/cmdline" ]; then
    tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null
  else
    ps -p "$pid" -o args= 2>/dev/null
  fi
}

# --- is our own instance already up? ----------------------------------------
running_pid() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  case "$pid" in *[!0-9]*) return 1 ;; esac
  kill -0 "$pid" 2>/dev/null || return 1
  # Guard against a recycled pid pointing at something else.
  proc_cmdline "$pid" | grep -q "http.server" || return 1
  printf '%s' "$pid"
}

stop_server() {
  local pid
  if pid="$(running_pid)"; then
    info "stopping server (pid $pid)"
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 30); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    ok "stopped"
  else
    info "no server recorded in $PID_FILE"
  fi
  rm -f "$PID_FILE" "$PORT_FILE"
}

wait_for_http() {
  local port="$1"
  for _ in $(seq 1 60); do
    if "$PYTHON" - "$port" <<'PYEOF' >/dev/null 2>&1
import sys, urllib.request
urllib.request.urlopen("http://127.0.0.1:%s/index.html" % sys.argv[1], timeout=1).read(1)
PYEOF
    then return 0; fi
    sleep 0.15
  done
  return 1
}

open_in_browser() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$url" >/dev/null 2>&1 &
  fi
}

run_checks() {
  local failed=0
  info "validating data"
  "$PYTHON" tools/check_data.py || failed=1
  info "validating scripts and links"
  "$PYTHON" tools/check_js.py || failed=1
  info "validating icons"
  "$PYTHON" tools/check_icons.py || failed=1
  if command -v node >/dev/null 2>&1; then
    info "unit tests (scheduling core)"
    node tools/test_srs.mjs || failed=1
    info "headless smoke test"
    node tools/smoke.mjs || failed=1
  else
    info "skipping the node checks (node not found)"
  fi
  return $failed
}

# --- argument parsing --------------------------------------------------------
# Looped, so flags may appear in any order: `start.sh --daemon --port 9000`
# used to silently drop --port because only $1 was examined.
ACTION="serve"
while [ $# -gt 0 ]; do
  case "$1" in
    --stop|--stop=*) ACTION="stop"; shift ;;
    --status)        ACTION="status"; shift ;;
    --check)         ACTION="check"; shift ;;
    --daemon)        DAEMON=1; shift ;;
    --detach)        DAEMON=1; OPEN_BROWSER=1; shift ;;
    --port)          PORT="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --port=*)        PORT="${1#*=}"; shift ;;
    -h|--help)       sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)               die "unknown option '$1' (try --help)" ;;
  esac
done
[ -n "$PORT" ] || die "--port needs a number."
case "$PORT" in ''|*[!0-9]*) die "port must be a number, got '$PORT'" ;; esac

case "$ACTION" in
  stop)
    stop_server
    exit 0
    ;;
  status)
    if pid="$(running_pid)"; then
      p="$(cat "$PORT_FILE" 2>/dev/null || echo "$PORT")"
      ok "running (pid $pid) on http://127.0.0.1:$p/"
      exit 0
    else
      info "not running"
      exit 1
    fi
    ;;
  check)
    run_checks
    exit $?
    ;;
esac

# --- refuse to double-start --------------------------------------------------
if pid="$(running_pid)"; then
  p="$(cat "$PORT_FILE" 2>/dev/null || echo "$PORT")"
  die "already running (pid $pid) on http://127.0.0.1:$p/ — use ./stop.sh or --stop"
fi
# A stale pid file from a crash would block every start.
rm -f "$PID_FILE" "$PORT_FILE"

# If the default port is taken by something else, try the next few.
attempts=0
chosen=""
while [ "$attempts" -lt 10 ]; do
  if ! port_in_use "$PORT"; then chosen="$PORT"; break; fi
  info "port $PORT is in use, trying $((PORT + 1))"
  PORT=$((PORT + 1))
  attempts=$((attempts + 1))
done
[ -n "$chosen" ] || die "no free port found near $DEFAULT_PORT (tried 10)."

# --- go ---------------------------------------------------------------------
printf '\n  ISLAM ACADEMY\n'
printf '  Arabic · Quran · Tajweed — offline first\n\n'
info "serving $DIR on port $chosen"
printf '  url:  http://127.0.0.1:%s/\n' "$chosen"
printf '  stop: %s/stop.sh\n\n' "$DIR"

if [ "$DAEMON" = "1" ]; then
  nohup "$PYTHON" -m http.server "$chosen" --bind 127.0.0.1 >> "$LOG_FILE" 2>&1 &
  pid=$!
  printf '%s' "$pid" > "$PID_FILE"
  printf '%s' "$chosen" > "$PORT_FILE"
  if wait_for_http "$chosen"; then
    ok "started (pid $pid)"
    printf '  log:  %s\n' "$LOG_FILE"
  else
    die "the server did not come up — see $LOG_FILE"
  fi
  if [ "$OPEN_BROWSER" = "1" ]; then
    open_in_browser "http://127.0.0.1:$chosen/"
  fi
  printf '  this shell can exit; run %s/stop.sh to stop it\n\n' "$DIR"
  exit 0
fi

trap 'printf "\n  stopping…\n"; kill %1 2>/dev/null; rm -f "$PID_FILE" "$PORT_FILE"; exit 0' INT TERM
"$PYTHON" -m http.server "$chosen" --bind 127.0.0.1 &
printf '%s' "$!" > "$PID_FILE"
printf '%s' "$chosen" > "$PORT_FILE"
[ "$OPEN_BROWSER" = "1" ] && open_in_browser "http://127.0.0.1:$chosen/"
wait $!
