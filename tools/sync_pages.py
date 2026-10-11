#!/usr/bin/env python3
"""Replace the copy-pasted responsive <style> block in every page with a
single link to assets/css/responsive.css.

The block was duplicated verbatim into each template and referenced classes
this project never had (.chat_page, .orb, .cyber-table, .moon-countdown, …),
so it added ~57 dead lines per page while the rules that actually mattered —
nav overflow, table scrolling, touch targets — lived in the wrong place.

Also injects the shared bits every page needs: the skip link, a favicon, the
manifest, responsive.css, and an inline theme bootstrap so a dark-mode learner
does not get a white flash on every navigation.

Run:  python3 tools/sync_pages.py
"""
import glob
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HEAD = """<link rel="stylesheet" href="{p}assets/css/responsive.css">
<link rel="icon" href="{p}assets/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{p}assets/icons/icon-192.png">
<link rel="manifest" href="{p}manifest.json">
<meta name="theme-color" content="#065f46" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1512" media="(prefers-color-scheme: dark)">
<meta name="description" content="{desc}">
<meta name="color-scheme" content="light dark">
<script>
/* Apply the stored theme before first paint, otherwise a dark-mode learner
   gets a white flash on every navigation. An explicit choice always wins;
   with no saved preference the OS setting is followed. */
(function () {{
  var t = null;
  try {{
    var s = JSON.parse(localStorage.getItem("islam-academy-v1") || "null");
    if (s && s.settings && s.settings.theme) t = s.settings.theme;
  }} catch (e) {{}}
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
}})();
</script>"""

DESCRIPTIONS = {
    "index.html": "Learn Arabic and the Quran from absolute zero — 28 letters, reading, grammar, tajweed and a hifz planner. Works offline.",
    "offline.html": "You are offline. Cached Islam Academy content is still available.",
    "pages/alphabet.html": "All 28 Arabic letters with pronunciation audio, the four positional forms and example words.",
    "pages/reading.html": "Practice Arabic reading: harakat, letter joining, practice words and a reading challenge.",
    "pages/grammar.html": "21 Arabic grammar lessons in 4 levels, Madinah-method progression, with quizzes and drills.",
    "pages/vocabulary.html": "Arabic vocabulary flashcards with an SM-2 spaced-repetition engine, roots and frequency data.",
    "pages/quran-reader.html": "Read all 6,236 ayat in Uthmani script with Saheeh International translation and tap-any-word meaning.",
    "pages/tajweed.html": "Tajweed rules taught with colour-coded examples: noon and meem sakinah, madd, qalqalah, tafkheem.",
    "pages/hifz.html": "Quran memorization planner using sabaq, sabqi and manzil with a juz tracker and revision log.",
    "pages/progress.html": "Your learning progress: XP, streaks, vocabulary memory statistics, streak calendar and JSON export.",
    "pages/search.html": "Search the whole academy: vocabulary, lessons, surah names and the Quran — in Arabic or English.",
    "pages/books.html": "Search and download Islamic books — Quran, tafsir, hadith, fiqh, seerah and more — from archive.org's open catalog.",
}

SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>'

STYLE_BLOCK = re.compile(
    r"[ \t]*<style>\s*\n\s*/\* === RESPONSIVE FIX \(auto-injected\) === \*/.*?</style>\n",
    re.S,
)


def main():
    changed = []
    for path in sorted(glob.glob(os.path.join(BASE, "*.html")) +
                       glob.glob(os.path.join(BASE, "pages", "*.html"))):
        rel = os.path.relpath(path, BASE)
        prefix = "../" if rel.startswith("pages/") else ""
        src = open(path, encoding="utf-8").read()
        original = src

        # 1. drop the inlined responsive block
        src, n = STYLE_BLOCK.subn("", src)

        # 2. shared <head> links, inserted after the last stylesheet link.
        #    The whole block is removed first so re-running is idempotent.
        head = HEAD.format(p=prefix, desc=DESCRIPTIONS.get(rel, ""))
        src, _ = re.subn(
            r'<link rel="stylesheet" href="' + re.escape(prefix) +
            r'assets/css/responsive\.css">[\s\S]*?</script>\n',
            "", src)
        last = None
        for m in re.finditer(r'<link rel="stylesheet"[^>]*>', src):
            last = m
        if last:
            src = src[:last.end()] + "\n" + head + src[last.end():]
        else:
            print(f"  ! {rel}: no stylesheet link to anchor to")

        # 3. <main> becomes the skip-link target
        src = re.sub(r"<main class=\"container\">",
                     '<main class="container" id="main" tabindex="-1">', src)

        # 4. skip link as the first body child
        if SKIP_LINK not in src:
            src = re.sub(r"(<body[^>]*>\n)", r"\1" + SKIP_LINK + "\n", src, count=1)

        # 5. every page registers the service worker, not just three of them.
        #    Always normalised, not just added, so the opt-out flag cannot go
        #    stale in files that already have the block.
        #    ?nosw=1 skips registration, which is what you want while editing:
        #    the worker serves HTML cache-first, so without it you keep testing
        #    a stale page and cannot tell a real fix from a cached one.
        sw_re = re.compile(
            r"<script>\s*\nif \('serviceWorker' in navigator[^)]*\)[^{]*\{\s*\n"
            r".*?\n</script>\n",
            re.S)
        src, had_sw = sw_re.subn(
            "<script>\n"
            "if ('serviceWorker' in navigator && !/[?&]nosw=1/.test(location.search)) {\n"
            "  window.addEventListener('load', function () {\n"
            f"    navigator.serviceWorker.register('{prefix}sw.js').catch(function () {{}});\n"
            "  });\n"
            "}\n"
            "</script>\n",
            src)
        if not had_sw:
            m = re.search(r'<script src="[^"]*assets/js/nav\.js"></script>\n', src)
            if m:
                sw_block = (
                    "<script>\n"
                    "if ('serviceWorker' in navigator && !/[?&]nosw=1/.test(location.search)) {\n"
                    "  window.addEventListener('load', function () {\n"
                    f"    navigator.serviceWorker.register('{prefix}sw.js').catch(function () {{}});\n"
                    "  });\n"
                    "}\n"
                    "</script>\n")
                src = src[:m.end()] + sw_block + src[m.end():]
            else:
                print(f"  ! {rel}: nav.js not found, SW not registered")

        if src != original:
            open(path, "w", encoding="utf-8").write(src)
            changed.append((rel, n))

    for rel, n in changed:
        print(f"  {rel}: removed {n} inlined style block(s)")
    if not changed:
        print("  (already in sync)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
