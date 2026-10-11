#!/usr/bin/env python3
"""Fetch Quranic word→root data and build data/quran/word-roots.json.

Source: the Quranic Arabic Corpus morphology (v0.4 fork maintained at
github.com/mustafa0x/quran-morphology, derived from corpus.quran.com and
licensed GPL).  It annotates every segment of every word in the Quran with a
part of speech, a lemma and — for content words — a triliteral root, so it is
the only source here that can tell a real root (كتاب → كتب) apart from a
function word that merely looks like it has one (مِن → no root at all).

The corpus keys its data by verse position, but the reader only knows the
surface token the learner tapped, so we collapse it to
``normalised surface form -> root``.  A handful of surface forms are genuinely
ambiguous (مَنَّ "to bestow" vs مِن "from"); those are resolved by majority
vote, and a form is only given a root when the majority of its occurrences
carry one.

Run:  python3 tools/fetch_roots.py
"""
import json, os, re, sys, time, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QDIR = os.path.join(BASE, "data", "quran")
OUT = os.path.join(QDIR, "word-roots.json")

# jsdelivr mirrors the repo; same CDN host the other fetch tools use.
URL = "https://cdn.jsdelivr.net/gh/mustafa0x/quran-morphology@master/quran-morphology.txt"
UA = {"User-Agent": "IslamAcademy/1.0 (offline study tool)"}


def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode("utf-8")
        except Exception as e:
            print(f"  retry {i+1}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {url}")


# Must stay byte-identical to keyWord()/toStandard() in pages/quran-reader.html,
# otherwise the reader looks up keys the data file does not contain.
_DIACRITICS = re.compile(
    "[\u0610-\u061A\u064B-\u065F\u0670"
    "\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]"
)
_TEXT_MAP = (
    ("\u0671", "\u0627"),  # alef wasla
    ("\u06E5", "\u0648"),  # small waw
    ("\u06E6", "\u064A"),  # small ya
    ("\u06E7", "\u064A"),  # small high ya
    ("\u06E8", "\u0646"),  # small high nun
    ("\u06ED", "\u0645"),  # small low meem
    ("\u0622", "\u0627"),  # alef madda
    ("\u0623", "\u0627"),  # alef with hamza above
    ("\u0625", "\u0627"),  # alef with hamza below
    ("\u0629", "\u0647"),  # ta marbuta
    ("\u0649", "\u064A"),  # alef maqsura
    ("\u0624", "\u0648"),  # waw with hamza
    ("\u0626", "\u064A"),  # ya with hamza
)


def key_word(text):
    t = _DIACRITICS.sub("", text)
    for a, b in _TEXT_MAP:
        t = t.replace(a, b)
    return t.strip()


# A root letter that is a hamza is written أ by the corpus; normalise the whole
# hamza/alef family onto it so both sides of a lookup agree regardless of the
# seat the scribe picked.
_ROOT_MAP = (
    ("\u0621", "\u0623"),  # standalone hamza
    ("\u0625", "\u0623"),
    ("\u0622", "\u0623"),
    ("\u0671", "\u0623"),
    ("\u0649", "\u064A"),
    ("\u0626", "\u064A"),  # ya with hamza
    ("\u0624", "\u0648"),  # waw with hamza
)


def canon_root(raw):
    """'موه' -> 'م.و.ه' —— dotted, hamza family folded onto أ."""
    t = _DIACRITICS.sub("", raw)
    for a, b in _ROOT_MAP:
        t = t.replace(a, b)
    return ".".join(t)


# Once the hamza family is folded onto أ, no real root keeps a bare alef — alef
# is a seat or a long vowel, never a root consonant. A handful of frozen forms
# (the imperatives هَاتُ "bring!" and هَاؤُم "here, take!") are still tagged
# with one, and displaying "ه ا ت" as a triliteral root for هاتوا teaches the
# wrong thing, so those are dropped and read as rootless instead.
def is_real_root(root):
    return "ا" not in root.split(".")


def parse_corpus(txt):
    """Return {verse:word -> {'segments': [(i, text)], 'root': str|None}}."""
    words = {}
    for line in txt.splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        loc, segment, _pos, features = parts[0], parts[1], parts[2], parts[3]
        nums = loc.split(":")
        if len(nums) != 4:
            continue
        entry = words.setdefault(":".join(nums[:3]), {"segments": [], "root": None})
        entry["segments"].append((int(nums[3]), segment))
        m = re.search(r"ROOT:([^|]+)", features)
        if m:
            entry["root"] = canon_root(m.group(1))
    return words


def build(words):
    """Collapse position-keyed data to a surface-form -> root map."""
    votes = {}
    for entry in words.values():
        surface = key_word("".join(s for _, s in sorted(entry["segments"])))
        if not surface:
            continue
        tally = votes.setdefault(surface, {})
        tally[entry["root"]] = tally.get(entry["root"], 0) + 1

    out, ambiguous, dropped, frozen = {}, 0, 0, []
    for surface, tally in sorted(votes.items()):
        # Drop roots that are not real before voting, but keep "no root" in the
        # running: a preposition that is tagged with a root a handful of times
        # out of thousands must still come out rootless.
        real = {r: n for r, n in tally.items() if is_real_root(r)} if None in tally \
            else {r: n for r, n in tally.items() if r and is_real_root(r)}
        tally = dict(real)
        tally[None] = tally.get(None, 0)
        root, _ = max(tally.items(), key=lambda kv: (kv[1], kv[0] is not None))
        if root is None:
            if len(real) > 0 and sum(votes[surface].values()) == sum(
                    n for r, n in votes[surface].items() if r and not is_real_root(r)):
                frozen.append(surface)
            dropped += 1
            continue
        if len(real) > 1:
            ambiguous += 1
        out[surface] = root
    return out, ambiguous, dropped, frozen


def canon_root_letters(dotted):
    """Re-normalise an ALREADY-dotted root. canon_root() takes an undotted
    string, so feeding it "أ.ت.ي" would produce "أ...ت...ي"."""
    return ".".join(
        _DIACRITICS.sub("", part).translate(_ROOT_TRANS)[0:1] or part
        for part in dotted.split(".")
    )


_ROOT_TRANS = {ord(a): b for a, b in _ROOT_MAP}


def main():
    # --prune re-applies the root validity rules to an existing file without
    # re-downloading the corpus. Needed because the committed map can predate a
    # rule change, and a stale entry shows up in the reader as a bogus root.
    if "--prune" in sys.argv:
        i = sys.argv.index("--prune")
        path = sys.argv[i + 1] if len(sys.argv) > i + 1 else OUT
        roots = json.load(open(path, encoding="utf-8"))
        before = len(roots)
        bad = {k: v for k, v in roots.items()
               if not is_real_root(v) or canon_root_letters(v) != v}
        for k, v in bad.items():
            fixed = canon_root_letters(v)
            if is_real_root(fixed):
                roots[k] = fixed
            else:
                del roots[k]
        json.dump(roots, open(path, "w", encoding="utf-8"), ensure_ascii=False,
                  indent=0, sort_keys=True)
        print(f"pruned/fixed {len(bad)} entries, {before} -> {len(roots)}")
        for k, v in list(bad.items())[:10]:
            print(f"  {k!r}: {v!r} -> {roots.get(k, '<dropped>')!r}")
        return 0

    print("[1/2] Downloading Quranic Arabic Corpus morphology...")
    txt = get(URL)
    print(f"      {len(txt) // 1024} KB, {len(txt.splitlines())} segment lines")

    print("[2/2] Building word -> root map...")
    words = parse_corpus(txt)
    roots, ambiguous, dropped, frozen = build(words)
    json.dump(roots, open(OUT, "w", encoding="utf-8"), ensure_ascii=False,
              indent=0, sort_keys=True)

    total = len(roots)
    distinct = len(set(roots.values()))
    print(f"DONE: {total} surface forms -> {distinct} distinct roots")
    print(f"      {dropped} forms correctly have no root (particles, pronouns)")
    print(f"      {ambiguous} ambiguous forms resolved by majority vote")
    print(f"      {len(frozen)} frozen forms dropped as rootless: "
          + ", ".join(frozen[:6]))
    print(f"      wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
