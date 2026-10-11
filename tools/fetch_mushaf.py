#!/usr/bin/env python3
"""Vendor the Madinah mushaf page layout so the reader works fully offline.

Upstream (zonetecde/mushaf-layout) publishes one JSON file per mushaf page:

    https://raw.githubusercontent.com/zonetecde/mushaf-layout/refs/heads/main/mushaf/page-NNN.json

The reader previously fetched those files at view time, which meant the Mushaf
view was the one feature that needed the network. This downloads all 604 once
and writes a single bundle:

    data/quran/mushaf-pages.json

Only the fields the renderer actually uses are kept — `page` and, per line,
`type`, `text` and `surah`. The upstream payload also carries per-word QPC
glyph codes (`qpcV1`/`qpcV2`), locations and verse ranges that nothing in the
academy renders; dropping them keeps the bundle roughly four times smaller.

Run:  python3 tools/fetch_mushaf.py
"""
import concurrent.futures
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "data", "quran", "mushaf-pages.json")
UPSTREAM = ("https://raw.githubusercontent.com/zonetecde/mushaf-layout/"
            "refs/heads/main/mushaf/")
TOTAL_PAGES = 604
WORKERS = 8
ATTEMPTS = 4


def compact(raw, page_number):
    """Keep only what renderMushafPage() reads."""
    lines = []
    for line in raw.get("lines", []):
        item = {"type": line.get("type") or "text", "text": line.get("text") or ""}
        if line.get("surah"):
            item["surah"] = line["surah"]
        lines.append(item)
    return {"page": int(raw.get("page") or page_number), "lines": lines}


def fetch(page_number, retries=ATTEMPTS):
    url = UPSTREAM + "page-%03d.json" % page_number
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            if not isinstance(raw, dict) or not isinstance(raw.get("lines"), list):
                raise ValueError("unexpected payload shape")
            return page_number, compact(raw, page_number), None
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError,
                TimeoutError, OSError) as e:
            last = e
    return page_number, None, repr(last)


def main():
    targets = list(range(1, TOTAL_PAGES + 1))
    done = {}
    failed = []

    print(f"fetching {len(targets)} mushaf pages from upstream …")
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for n, page, err in pool.map(fetch, targets):
            if err:
                failed.append((n, err))
            else:
                done[n] = page
            total = len(done) + len(failed)
            if total % 50 == 0:
                print(f"  {total}/{len(targets)}")

    if failed:
        print(f"\n{len(failed)} page(s) failed after {ATTEMPTS} attempts:")
        for n, err in failed[:20]:
            print(f"  page {n}: {err}")
        if len(failed) > 20:
            print(f"  … and {len(failed) - 20} more")
        print("\nNothing written — rerun to retry (already-fetched pages are free).")
        return 1

    missing = [n for n in targets if n not in done]
    if missing:
        print(f"missing pages: {missing[:20]}")
        return 1

    bundle = {
        "source": UPSTREAM,
        "note": ("Vendored Madinah mushaf page layout. Fields kept: page and, per "
                 "line, type/text/surah — everything renderMushafPage() uses. "
                 "Regenerate with tools/fetch_mushaf.py."),
        "firstPage": 1,
        "lastPage": TOTAL_PAGES,
        # Index 0 is page 1, so the reader can do pages[n - 1].
        "pages": [done[n] for n in targets],
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    size = os.path.getsize(OUT)
    lines = sum(len(p["lines"]) for p in bundle["pages"])
    print(f"\nwrote {os.path.relpath(OUT, BASE)} — {len(bundle['pages'])} pages, "
          f"{lines} lines, {size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
