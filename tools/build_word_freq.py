#!/usr/bin/env python3
"""Count how often each curriculum headword occurs in the Quran.

This backs the Progress page's "you now know X% of the Quran's running words"
estimate. Tokenising 1.4 MB of Uthmani text in the browser on every visit would
be wasteful, and the ~16,000 distinct surface forms are far more data than the
estimate needs — only the ~590 headwords in the decks matter.

Output: data/quran/word-freq.json

    {
      "totalWords": 79848,                 # tokens in the bundled Uthmani text
      "source": "...",
      "counts": {
        "<exact deck headword>": {"n": "<normalised form>", "c": <occurrences>},
        ...
      }
    }

The `n` field lets the Progress page de-duplicate headwords that normalise to
the same form (e.g. علم and عَلِمَ) without re-implementing Arabic normalisation
in JavaScript.

Run:  python3 tools/build_word_freq.py
"""
import json
import os
import re
import sys
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QURAN = os.path.join(BASE, "data", "quran")
CURRICULUM = os.path.join(BASE, "data", "curriculum")
OUT = os.path.join(QURAN, "word-freq.json")
SOURCE = "Tanzil Uthmani via fawazahmed0/quran-api (bundled as data/quran/uthmani.json)"

# Tashkeel and Quranic annotation marks. Mirrors stripDiac() in assets/js/app.js
# and stripDiacritics() in pages/quran-reader.html; the folds below mirror the
# reader's toStandard()/keyWord().
TASHKEEL = re.compile("[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC"
                      "\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]")


def normalise(token):
    """Fold a surface form to a comparison key (diacritics and orthography)."""
    t = TASHKEEL.sub("", token)
    t = t.replace("\u06E5", "\u0648").replace("\u06E6", "\u064A")  # small waw/ya
    t = t.replace("\u0640", "")                                    # tatweel
    t = t.replace("\u0671", "\u0627")                              # alef wasla
    t = t.replace("\u0622", "\u0627")                              # alef madda
    t = t.replace("\u0623", "\u0627")                              # hamza above
    t = t.replace("\u0625", "\u0627")                              # hamza below
    t = t.replace("\u0649", "\u064A")                              # alef maqsura
    t = t.replace("\u0626", "\u064A")                              # ya hamza
    t = t.replace("\u0624", "\u0648")                              # waw hamza
    t = t.replace("\u0629", "\u0647")                              # ta marbuta
    return t.strip()


def load(name, folder):
    with open(os.path.join(folder, name), encoding="utf-8") as fh:
        return json.load(fh)


def main():
    quran = load("uthmani.json", QURAN)
    decks = load("decks.json", CURRICULUM)

    forms = Counter()
    total = 0
    for ayat in quran.values():
        for ayah in ayat:
            text = ayah["t"] if isinstance(ayah, dict) else ayah
            for token in text.split():
                total += 1
                forms[normalise(token)] += 1

    headwords = []
    seen = set()
    for deck in decks.values():
        for word in deck.get("words", []):
            ar = word.get("ar")
            if ar and ar not in seen:
                seen.add(ar)
                headwords.append(ar)

    counts = {}
    found = 0
    covered = 0
    for ar in headwords:
        key = normalise(ar)
        c = forms.get(key, 0)
        counts[ar] = {"n": key, "c": c}
        if c:
            found += 1
            covered += c

    payload = {
        "totalWords": total,
        "source": SOURCE,
        "note": ("Occurrence counts for curriculum headwords, keyed by the exact "
                 "deck spelling. `n` is the normalised form used for counting and "
                 "de-duplication; `c` is how many times that form appears. "
                 "Regenerate with tools/build_word_freq.py."),
        "counts": counts,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    os.replace(tmp, OUT)

    pct = (100.0 * covered / total) if total else 0.0
    print(f"Quran tokens           : {total:,}")
    print(f"distinct forms         : {len(forms):,}")
    print(f"deck headwords         : {len(headwords)} "
          f"({found} found in the text, {len(headwords) - found} absent)")
    print(f"full-deck coverage     : {pct:.1f}% of running words")
    print(f"wrote {os.path.relpath(OUT, BASE)} "
          f"({os.path.getsize(OUT) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
