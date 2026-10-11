#!/usr/bin/env python3
"""One-off repair of the duplicate / malformed entries in decks.json.

tools/check_data.py flags every one of these; each needs a content decision
rather than a mechanical fix, so the reasoning is recorded here instead of
being rediscovered later. Re-running is a no-op once the file is clean.

  1. quran-core "علم"      — a noun and a verb from one root were given the
                              same undiacritised spelling, so they collided as
                              flashcards. The verb keeps its own vocalisation.
  2. surah-vocab "الْعَالَمِينَ" — one word, two English glosses for the two
                              grammatical roles it plays. Merged.
  3. quran-prepositions "في" — the corpus splits this preposition across two
                              orthographic shapes, so it produced two cards with
                              the same text. Frequencies summed.
  4. quran-prepositions "أمام" — two hand-written glosses of one word.
  5. quran-pronouns "هم"    — the independent pronoun "they" and the enclitic
                              "-them" are different words that share a spelling.
                              The enclitic is written هُم as it appears attached.

Run:  python3 tools/fix_decks.py
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(BASE, "data", "curriculum", "decks.json")


def main():
    decks = json.load(open(PATH, encoding="utf-8"))
    applied = []

    def find(deck, ar):
        for w in decks[deck]["words"]:
            if w["ar"] == ar:
                return w
        return None

    # 1. علم — keep the noun, give the verb its own spelling.
    noun = find("quran-core", "علم")
    if noun and noun.get("en") == "knowledge":
        verb = None
        for w in decks["quran-core"]["words"]:
            if w["ar"] == "علم" and w is not noun:
                verb = w
        if verb is not None:
            verb["ar"] = "عَلِمَ"
            verb["tl"] = "alima"
            verb["en"] = "he knew / to know"
            verb["pattern"] = "فَعَلَ"
            applied.append("quran-core: ʿalima given its own vocalisation (عَلِمَ)")

    # 2. الْعَالَمِينَ — one word, two roles, so it must become one card.
    dupes = [w for w in decks["surah-vocab"]["words"] if w["ar"] == "الْعَالَمِينَ"]
    if len(dupes) > 1:
        keep = dupes[0]
        keep["en"] = "the worlds / of the worlds"
        for extra in dupes[1:]:
            decks["surah-vocab"]["words"].remove(extra)
        applied.append("surah-vocab: الْعَالَمِينَ collapsed to one card")

    # 3. في — the corpus counts two orthographic shapes separately.
    seen = [w for w in decks["quran-prepositions"]["words"] if w["ar"] == "في"]
    if len(seen) == 2:
        keep, drop = sorted(seen, key=lambda w: -(w.get("freq") or 0))
        keep["freq"] = (keep.get("freq") or 0) + (drop.get("freq") or 0)
        keep["en"] = "in / into / by means of"
        keep["tl"] = "fee"
        decks["quran-prepositions"]["words"].remove(drop)
        applied.append(f"quran-prepositions: في merged (freq {keep['freq']})")

    # 4. أمام — two glosses of one word.
    seen = [w for w in decks["quran-prepositions"]["words"] if w["ar"] == "أمام"]
    if len(seen) == 2:
        keep, drop = seen
        keep["en"] = "in front of / before"
        keep["freq"] = (keep.get("freq") or 0) + (drop.get("freq") or 0)
        decks["quran-prepositions"]["words"].remove(drop)
        applied.append("quran-prepositions: أمام merged")

    # 5. هُم — the enclitic "-them", distinct from the independent pronoun.
    for w in decks["quran-pronouns"]["words"]:
        if w["ar"] == "هم" and "suffix" in (w.get("en") or ""):
            w["ar"] = "هُم"
            w["tl"] = "hum (suffix)"
            w["en"] = "them / their (attached -hum)"
            applied.append("quran-pronouns: enclitic -hum written هُم")

    # 6. ذو الجلال — a legitimate two-word Arabic name; give it the vocalisation
    #    the 99 names are usually written with, which also makes the card unique.
    for w in decks["divine-names"]["words"]:
        if w["ar"] == "ذو الجلال":
            w["ar"] = "ذُو الْجَلَالِ"
            applied.append("divine-names: ذو الجلال vocalised (ذُو الْجَلَالِ)")

    json.dump(decks, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for a in applied:
        print("  -", a)
    if not applied:
        print("  (already clean)")
    print(f"wrote {os.path.relpath(PATH, BASE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
