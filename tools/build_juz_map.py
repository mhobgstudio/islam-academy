#!/usr/bin/env python3
"""Build data/quran/juz_map.json — the surah range that starts each juz.

hifz.html used `m.number >= (j-1)*4+1 && m.number <= j*4+2` to guess which
surahs a memorised juz contains. That is simply false: juz 30 holds surahs
78-114, and the formula maps it to 117-122, i.e. nothing. Memorising all of
juz 30 therefore always fell back to the "no memorised surah" branch.

The table below is the standard Madinah-mushaf division and is the same one
quran-reader.html already uses for juz -> page. It is written as explicit
data rather than derived so tools/check_data.py can verify that the 30 ranges
are contiguous and cover all 114 surahs exactly once.

Run:  python3 tools/build_juz_map.py
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "data", "quran", "juz_map.json")

# (first surah of the juz, first page in the Madinah mushaf)
# Note juz 6 starts at An-Nisa 4:24 and juz 7 at An-Nisa 4:148 — both inside
# surah 4, so a surah can open two consecutive juz. The page numbers are what
# disambiguate them.
JUZ_STARTS = [
    (1, 1), (2, 2), (2, 42), (2, 62), (3, 82), (4, 102), (4, 122), (5, 142),
    (6, 162), (7, 182), (9, 202), (11, 222), (12, 242), (15, 262), (17, 282),
    (18, 302), (21, 322), (23, 342), (25, 362), (27, 382), (29, 402), (33, 422),
    (36, 442), (39, 462), (41, 482), (46, 502), (51, 522), (58, 542), (67, 562),
    (78, 582),
]

LAST_SURAH = 114
LAST_PAGE = 604


def main():
    if len(JUZ_STARTS) != 30:
        print("expected 30 juz entries, got", len(JUZ_STARTS))
        return 1

    juz = []
    for i, (first_surah, page) in enumerate(JUZ_STARTS, start=1):
        nxt = JUZ_STARTS[i] if i < len(JUZ_STARTS) else (LAST_SURAH + 1, LAST_PAGE + 1)
        juz.append({
            "juz": i,
            "start_surah": first_surah,
            # A surah that straddles a juz boundary appears in both, which is
            # correct: it is genuinely part of each.
            "end_surah": max(first_surah, nxt[0] - 1),
            "page": page,
            "end_page": nxt[1] - 1,
        })

    meta = json.load(open(os.path.join(BASE, "data", "quran", "surah_meta.json"),
                         encoding="utf-8"))
    ayahs = {m["number"]: m["ayahs"] for m in meta}
    for j in juz:
        j["ayahs"] = sum(ayahs[s] for s in range(j["start_surah"], j["end_surah"] + 1))

    json.dump(juz, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Self-check: the ranges must be monotonic and reach the last surah.
    problems = []
    for k in range(1, 30):
        if juz[k]["start_surah"] < juz[k - 1]["start_surah"]:
            problems.append(f"juz {k + 1} starts before juz {k}")
    if juz[-1]["end_surah"] != LAST_SURAH:
        problems.append(f"last juz ends at {juz[-1]['end_surah']}, expected {LAST_SURAH}")
    if juz[0]["start_surah"] != 1:
        problems.append("juz 1 must start at surah 1")

    print(f"wrote {os.path.relpath(OUT, BASE)}: {len(juz)} juz")
    for j in juz:
        print(f"  juz {j['juz']:2d}  surahs {j['start_surah']:3d}-{j['end_surah']:3d}"
              f"  pages {j['page']:3d}-{j['end_page']:3d}  {j['ayahs']:3d} ayat")
    if problems:
        print("\nproblems:")
        for p in problems:
            print("  -", p)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
