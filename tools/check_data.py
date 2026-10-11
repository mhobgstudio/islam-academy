#!/usr/bin/env python3
"""Validate the curriculum + Quran data files. Exit non-zero on any problem.

This exists because the root data has three moving parts that must agree:
  * decks.json            — the vocabulary words and the root each one belongs to
  * root-lexicon.json     — root -> core meaning, shared by the flashcards, the
                            Grammar roots drill and the reader popover
  * word-roots.json       — surface form -> root, generated from the Quranic
                            Arabic Corpus by tools/fetch_roots.py

Run:  python3 tools/check_data.py
"""
import json, os, re, sys
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM = os.path.join(BASE, "data", "curriculum")
QURAN = os.path.join(BASE, "data", "quran")

# A root letter must be one Arabic letter; the hamza family is written أ and the
# hamza seats are folded (ئ -> ي, ؤ -> و).
ROOT_LETTER = re.compile("^[\u0621-\u064A]$")
# The Arabic field holds the headword. Spaces are legal — some of the 99 names
# are genuinely two words (ذُو الْجَلَالِ) — but it must contain no Latin text,
# which is the failure this is really guarding against.
ARABIC_ONLY = re.compile("^(?:[\u0600-\u06FF\u0750-\u077F\uFE70-\uFEFF]+)(?: +[\u0600-\u06FF\u0750-\u077F\uFE70-\uFEFF]+)*$")
HAMZA_FAMILY = "\u0621\u0625\u0622\u0671\u0627"

# Independent re-implementation of the fold used by tools/build_word_freq.py.
# The validator deliberately does NOT import that module: the point is to catch
# the two disagreeing, which an import would hide.
TASHKEEL = re.compile("[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC"
                      "\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]")
FOLDS = str.maketrans({
    "\u06E5": "\u0648", "\u06E6": "\u064A", "\u0640": "",
    "\u0671": "\u0627", "\u0622": "\u0627", "\u0623": "\u0627", "\u0625": "\u0627",
    "\u0649": "\u064A", "\u0626": "\u064A", "\u0624": "\u0648", "\u0629": "\u0647",
})


def fold(token):
    return TASHKEEL.sub("", token).translate(FOLDS).strip()


problems = []


def check(condition, message):
    if not condition:
        problems.append(message)


def load(name, folder=CURRICULUM):
    path = os.path.join(folder, name)
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception as e:
        problems.append(f"{name}: not valid JSON ({e})")
        return {}


def main():
    decks = load("decks.json")
    lexicon = load("root-lexicon.json")
    levels = load("levels.json")
    alphabet = load("alphabet.json")
    tajweed = load("tajweed.json")
    word_roots = load("word-roots.json", QURAN)
    mushaf = load("mushaf-pages.json", QURAN)
    word_freq = load("word-freq.json", QURAN)

    words = [(deck_name, w) for deck_name, deck in decks.items()
             for w in deck.get("words", [])]

    # ---- decks.json ----
    for deck_name, deck in decks.items():
        check(deck.get("words"), f"{deck_name}: deck has no words")
        seen = set()
        for w in deck.get("words", []):
            key = w.get("ar")
            check(key, f"{deck_name}: a word has no Arabic text")
            check(key not in seen, f"{deck_name}: duplicate word {key!r}")
            seen.add(key)
            check(ARABIC_ONLY.match(key or ""),
                  f"{deck_name}/{key}: Arabic field contains non-Arabic characters")
            root = w.get("root")
            if root:
                parts = root.split(".")
                check(len(parts) == 3 or len(parts) == 4,
                      f"{deck_name}/{key}: root {root!r} is not 3-4 letters")
                for p in parts:
                    check(ROOT_LETTER.match(p),
                          f"{deck_name}/{key}: root {root!r} has a bad letter {p!r}")
                    check(p not in HAMZA_FAMILY,
                          f"{deck_name}/{key}: root {root!r} spells hamza as "
                          f"{p!r} — use \u0623 (see tools/check_data.py)")
                check(root in lexicon,
                      f"{deck_name}/{key}: root {root!r} has no meaning in root-lexicon.json")
            else:
                check(w.get("type"),
                      f"{deck_name}/{key}: has no root and no type")

    # ---- root-lexicon.json ----
    for root, meaning in lexicon.items():
        check(len(root.split(".")) in (3, 4),
              f"root-lexicon: {root!r} is not 3-4 letters")
        for p in root.split("."):
            check(ROOT_LETTER.match(p), f"root-lexicon: {root!r} has a bad letter {p!r}")
            check(p not in HAMZA_FAMILY,
                  f"root-lexicon: {root!r} spells hamza as {p!r} — use \u0623")
        check(meaning and meaning.strip(),
              f"root-lexicon: {root!r} has an empty meaning")

    # ---- word-roots.json ----
    for surface, root in word_roots.items():
        if not surface:
            problems.append("word-roots: empty surface key")
        if len(root.split(".")) not in (3, 4):
            problems.append(f"word-roots: {surface!r} -> {root!r} is not 3-4 letters")
        for p in root.split("."):
            if p in HAMZA_FAMILY:
                problems.append(f"word-roots: {surface!r} -> {root!r} spells hamza as {p!r}")
                break

    # ---- levels.json ----
    for level_num, level in levels.items():
        check("title" in level, f"levels/{level_num}: missing title")
        for lesson in level.get("lessons", []):
            lid = lesson.get("id", "?")
            check(lid.startswith(f"L{level_num}."),
                  f"levels/{level_num}: lesson id {lid!r} does not match its level")
            for drill in lesson.get("drills", []):
                kind = drill.get("type")
                check(kind in ("mc", "match", "root"),
                      f"{lid}: unknown drill type {kind!r}")
                if kind == "match":
                    check(drill.get("pairs"), f"{lid}: match drill has no pairs")
                if kind == "root":
                    check(drill.get("mode") in ("word", "meaning"),
                          f"{lid}: root drill needs mode 'word' or 'meaning'")

    # ---- vendored mushaf bundle ----
    # The Mushaf view is fully offline because every page ships locally; a
    # partial bundle would silently drop pages behind the fallback panel.
    pages = mushaf.get("pages") if isinstance(mushaf, dict) else None
    if not isinstance(pages, list):
        problems.append("mushaf-pages.json: 'pages' is not a list")
    else:
        check(len(pages) == 604,
              f"mushaf-pages.json: {len(pages)} pages, expected 604")
        check(mushaf.get("firstPage") == 1, "mushaf-pages.json: firstPage should be 1")
        check(mushaf.get("lastPage") == 604, "mushaf-pages.json: lastPage should be 604")
        for i, page in enumerate(pages):
            number = i + 1
            if page.get("page") != number:
                problems.append(f"mushaf-pages.json: entry {i} is numbered "
                                f"{page.get('page')!r}, expected {number}")
                break
            if not isinstance(page.get("lines"), list) or not page["lines"]:
                problems.append(f"mushaf-pages.json: page {number} has no lines")
                break
            for line in page["lines"]:
                if line.get("type") not in ("text", "surah-header", "basmala"):
                    problems.append(f"mushaf-pages.json: page {number} has an "
                                    f"unknown line type {line.get('type')!r}")
                    break

    # ---- word-freq.json ----
    # Backs the Progress page's "you now know X% of the Quran's running words"
    # stat. It is generated data, so a renamed deck headword or a changed
    # normalisation rule would leave the browser reporting stale percentages.
    # Every count is therefore recomputed from the bundled Uthmani text.
    uthmani = load("uthmani.json", QURAN)
    forms = Counter()
    tokens = 0
    for ayat in uthmani.values():
        for ayah in ayat:
            text = ayah["t"] if isinstance(ayah, dict) else ayah
            for token in text.split():
                tokens += 1
                forms[fold(token)] += 1
    counts = word_freq.get("counts") if isinstance(word_freq, dict) else None
    if not isinstance(counts, dict) or not counts:
        problems.append("word-freq.json: 'counts' is missing or empty")
    else:
        check(word_freq.get("totalWords") == tokens,
              f"word-freq.json: totalWords is {word_freq.get('totalWords')!r}, "
              f"but data/quran/uthmani.json holds {tokens} tokens — rerun "
              f"tools/build_word_freq.py")
        headwords = {w.get("ar") for _, w in words if w.get("ar")}
        missing = headwords - set(counts)
        if missing:
            problems.append(f"word-freq.json: {len(missing)} deck headword(s) "
                            f"have no entry (e.g. {sorted(missing)[0]!r}) — "
                            f"rerun tools/build_word_freq.py")
        stale = 0
        for ar, entry in counts.items():
            if not isinstance(entry, dict) or "n" not in entry or "c" not in entry:
                problems.append(f"word-freq.json: {ar!r} is not {{n, c}}")
                break
            expected = fold(ar)
            if entry["n"] != expected:
                problems.append(f"word-freq.json: {ar!r} normalises to "
                                f"{entry['n']!r}, expected {expected!r}")
                break
            if entry["c"] != forms.get(expected, 0):
                stale += 1
        if stale:
            problems.append(f"word-freq.json: {stale} occurrence count(s) are "
                            f"stale — rerun tools/build_word_freq.py")

    # ---- alphabet / tajweed ----
    check(alphabet, "alphabet.json is empty")
    check(tajweed, "tajweed.json is empty")

    # ---- audio references ----
    # app.js carries the text -> clip map and alphabet.json names its own
    # clips. A missing file is invisible in review and in the browser (the
    # button simply does nothing), which is exactly how a dead-audio bug ships.
    audio_refs = 0
    app_path = os.path.join(BASE, "assets", "js", "app.js")
    app_js = open(app_path, encoding="utf-8").read()
    m = re.search(r"const audioMap = \{(.*?)\n  \};", app_js, re.S)
    if not m:
        problems.append("app.js: could not find the audioMap block")
    else:
        for rel in re.findall(r'"([^"]+\.mp3)"', m.group(1)):
            audio_refs += 1
            if not os.path.exists(os.path.join(BASE, "assets", "audio", rel)):
                problems.append(f"app.js audioMap: missing assets/audio/{rel}")
    for letter in alphabet:
        for field in ("audio", "example_audio"):
            rel = letter.get(field)
            if rel and not os.path.exists(os.path.join(BASE, "assets", "audio", rel)):
                problems.append(f"alphabet.json/{letter.get('name')}: missing "
                                f"assets/audio/{rel} (field {field})")

    # Every deck headword is voiced by gen_audio.py, so every one must have its
    # own exact key. Without this, a headword renamed by tools/fix_decks.py
    # silently strip-matches a sibling's clip and is pronounced as the wrong word.
    if m:
        mapped_keys = set(re.findall(r'"([^"]+)":\s*"[^"]+\.mp3"', m.group(1)))
        unmapped = set()
        for deck_name, deck in decks.items():
            for w in deck.get("words", []):
                ar = w.get("ar")
                if ar and ar not in mapped_keys:
                    unmapped.add((deck_name, ar))
        for deck_name, ar in sorted(unmapped):
            problems.append(f"app.js audioMap: {deck_name}/{ar} has no exact clip "
                            f"(renamed headword?) — rerun tools/gen_audio.py")

    total = len(words)
    rooted = sum(1 for _, w in words if w.get("root"))
    unrooted = sum(1 for _, w in words if not w.get("root"))
    print(f"decks        : {len(decks)} decks, {total} words "
          f"({rooted} with a root, {unrooted} typed as function words)")
    print(f"lexicon      : {len(lexicon)} roots")
    print(f"word-roots   : {len(word_roots)} surface forms")
    print(f"levels       : {sum(len(l.get('lessons', [])) for l in levels.values())} lessons")
    print(f"mushaf       : {len(pages) if isinstance(pages, list) else 0} vendored page layouts")
    if isinstance(counts, dict) and tokens:
        best = {}
        for ar, entry in counts.items():
            if isinstance(entry, dict):
                best[entry.get("n")] = max(best.get(entry.get("n"), 0), entry.get("c") or 0)
        covered = sum(best.values())
        print(f"word-freq    : {len(counts)} headword counts, {covered}/{tokens} "
              f"({100.0 * covered / tokens:.1f}%) of running words reachable from the curriculum")
    print(f"audio        : {audio_refs} mapped clips + {len(alphabet) * 2} letter clips")

    if problems:
        print(f"\n{len(problems)} problem(s):")
        for p in problems[:60]:
            print("  -", p)
        if len(problems) > 60:
            print(f"  ... and {len(problems) - 60} more")
        return 1
    print("\nAll data checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
