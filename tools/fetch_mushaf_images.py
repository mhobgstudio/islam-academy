#!/usr/bin/env python3
"""Download the colour-coded tajweed mushaf page images (QuranHub, public
domain) into assets/images/mushaf/tajweed/ for offline use.

Run:  python3 tools/fetch_mushaf_images.py [first] [last]
"""
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "images", "mushaf", "tajweed")
SRC = "https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/ayat/tajweed/%d.png"
UA = {"User-Agent": "Mozilla/5.0"}


def main():
    os.makedirs(OUT, exist_ok=True)
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    last = int(sys.argv[2]) if len(sys.argv) > 2 else 604
    for n in range(first, last + 1):
        dest = os.path.join(OUT, "%d.png" % n)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            continue
        req = urllib.request.Request(SRC % n, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as fh:
            fh.write(r.read())
        print("page", n)
    print("done:", len(os.listdir(OUT)), "pages")


if __name__ == "__main__":
    main()