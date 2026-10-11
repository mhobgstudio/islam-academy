#!/usr/bin/env python3
"""Download the mushaf page images (QuranHub, public domain) into
assets/images/mushaf/<set>/ for offline use.

Sets: tajweed (colour-coded), hafs (clean Hafs).

Run:  python3 tools/fetch_mushaf_images.py [set] [first] [last]
"""
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {
    "tajweed": "https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/ayat/tajweed/%d.png",
    "hafs": "https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/ayat/hafs/%d.png",
}
UA = {"User-Agent": "Mozilla/5.0"}


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "tajweed"
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    last = int(sys.argv[3]) if len(sys.argv) > 3 else 604
    if which not in SRC:
        print("unknown set", which, "— choose from", ", ".join(SRC))
        return
    out = os.path.join(BASE, "assets", "images", "mushaf", which)
    os.makedirs(out, exist_ok=True)
    for n in range(first, last + 1):
        dest = os.path.join(out, "%d.png" % n)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            continue
        req = urllib.request.Request(SRC[which] % n, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as fh:
            fh.write(r.read())
        print("page", n)
    print("done:", len(os.listdir(out)), "pages")


if __name__ == "__main__":
    main()