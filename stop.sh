#!/usr/bin/env bash
#
# ISLAM ACADEMY — stop the local server started by start.sh.
#
#   ./stop.sh            stop it
#   ./stop.sh --status   report whether it is running
#   ./stop.sh --clean    also delete the pid/port files and the log
#
# Only ever stops a process this project started: the pid file is verified
# against /proc before anything is signalled, so a recycled pid belonging to an
# unrelated program is left alone.
set -uo pipefail

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

RUN_DIR="$DIR/.run"
PID_FILE="$RUN_DIR/server.pid"
PORT_FILE="$RUN_DIR/port"
LOG_FILE="$DIR/.smoke/server.log"

info() { printf '\033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

CLEAN=0
ACTION="stop"
case "${1:-}" in
  "")       : ;;                                  # bare ./stop.sh just stops
  --status) ACTION="status"; shift ;;
  --clean)  CLEAN=1; shift ;;
  -h|--help) sed -n '3,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *)        die "unknown option '$1' (try --help)" ;;
esac
[ $# -eq 0 ] || die "unknown option '$1' (try --help)"

PYTHON=""
for c in python3 python; do
  command -v "$c" >/dev/null 2>&1 && { PYTHON="$c"; break; }
done
[ -n "$PYTHON" ] || die "python3 is required but was not found on PATH."

# The command line of a pid, without depending on Linux-only /proc. macOS and
# slim containers fall back to `ps`, so ownership can still be verified there.
proc_cmdline() {
  local pid="$1"
  if [ -r "/proc/$pid/cmdline" ]; then
    tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null
  else
    ps -p "$pid" -o args= 2>/dev/null
  fi
}

# Does the pid in the file belong to a python http.server we started?
server_pid() {
  [ -f "$PID_FILE" ] || return 1
  local pid cmd
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  case "$pid" in *[!0-9]*) return 1 ;; esac
  kill -0 "$pid" 2>/dev/null || return 1
  cmd="$(proc_cmdline "$pid")"
  case "$cmd" in
    *http.server*) printf '%s' "$pid"; return 0 ;;
    *) return 1 ;;
  esac
}

port_still_listening() {
  local port="$1"
  "$PYTHON" - "$port" <<'PYEOF' 2>/dev/null
import socket, sys
s = socket.socket(); s.settimeout(0.4)
sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)
PYEOF
}

# ---------------------------------------------------------------------------
if [ "$ACTION" = "status" ]; then
  if pid="$(server_pid)"; then
    port="$(cat "$PORT_FILE" 2>/dev/null || echo '?')"
    ok "running (pid $pid) on http://127.0.0.1:$port/"
    exit 0
  fi
  info "not running"
  exit 1
fi

# --- stop --------------------------------------------------------------------
if pid="$(server_pid)"; then
  port="$(cat "$PORT_FILE" 2>/dev/null || echo '?')"
  info "stopping server (pid $pid, port $port)"

  # Politely first so the OS can close the listening socket cleanly.
  kill -TERM "$pid" 2>/dev/null

  gone=0
  for _ in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || { gone=1; break; }
    sleep 0.1
  done

  if [ "$gone" = "1" ]; then
    ok "stopped cleanly"
  else
    warn "did not exit after TERM, sending KILL"
    kill -KILL "$pid" 2>/dev/null
    sleep 0.3
    kill -0 "$pid" 2>/dev/null && die "pid $pid is still alive and is not ours to kill."
    ok "stopped (forced)"
  fi

  # Confirm the socket is actually free again.
  case "$port" in
    ''|*[!0-9]*) ;;
    *) sleep 0.2
       if port_still_listening "$port"; then
         warn "port $port is still accepting connections — another process may have taken it."
       else
         ok "port $port released"
       fi
       ;;
  esac
else
  if [ -f "$PID_FILE" ]; then
    warn "pid file exists but no matching server process — cleaning it up"
  else
    info "no server recorded in $PID_FILE — nothing to stop"
  fi
fi

rm -f "$PID_FILE" "$PORT_FILE"

if [ "$CLEAN" = "1" ]; then
  rm -rf "$DIR/.smoke"
  ok "removed .smoke/ (log and screenshots)"
fi

ok "done"
