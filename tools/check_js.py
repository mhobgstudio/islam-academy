#!/usr/bin/env python3
"""Extract every inline <script> block from the HTML pages and syntax-check it
with node. Catches the class of error that a browser only reports at runtime.

Run:  python3 tools/check_js.py
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def blocks(path):
    src = open(path, encoding="utf-8").read()
    out = []
    for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", src, re.S):
        out.append(m.group(1))
    return out


def check_tashkeel_regexes():
    """Guard against the literal-character-class bug.

    A hand-typed class like [ؐ-ًؚ-ٰ…] is *not* the same as the escape form
    \\u0610-\\u061A \\u064B-\\u065F \\u0670: written out, the two consecutive
    endpoints fuse into U+061A-U+0670, a range that swallows every Arabic
    letter and silently reduces whole words to nothing. This is invisible in
    review and breaks audio lookup and the word popover, so it is asserted.
    """
    import subprocess as sp
    cases = [
        ("assets/js/app.js", "stripDiac"),
        ("pages/quran-reader.html", "stripDiacritics"),
    ]
    # Samples are built from explicit codepoints so there is no ambiguity
    # about which combining marks a literal string actually contains — that
    # ambiguity is exactly what let the original bug through review.
    A = 0x064E  # fatha
    D = 0x064F  # damma
    K = 0x064E + 0  # keep symbolic
    SH = 0x0651  # shaddah
    SK = 0x0652  # sukun
    KS = 0x0650  # kasra
    WA = 0x0671  # alef wasla
    AL = 0x0627  # alef
    LAM = 0x0644  # lam
    HA = 0x0647   # ha
    TW = 0x0640   # tatweel
    SA = 0x0670   # superscript alef

    def s(*cps):
        return "".join(chr(c) for c in cps)

    samples = [
        (s(WA, LAM, LAM, SH, A, HA, D), s(WA, LAM, LAM, HA)),
        (s(0x0628, KS, 0x0633, SK, 0x0645, KS), s(0x0628, 0x0633, 0x0645)),
        (s(0x0642, D, LAM, SK), s(0x0642, LAM)),
        (s(AL, LAM, 0x0635, KS, SH, A, 0x0631, A, AL, 0x0637, KS), s(AL, LAM, 0x0635, 0x0631, AL, 0x0637)),
        (s(0x0645, A, TW, SA), s(0x0645, TW)),  # tatweel must survive
    ]
    bad = []
    for rel, fn in cases:
        path = os.path.join(BASE, rel)
        src = open(path, encoding="utf-8").read()
        m = re.search(r"function\s+" + fn + r"\([^)]*\)\s*\{[^}]*?replace\((/.*?/)([gimsuy]*)", src, re.S)
        if not m:
            bad.append(f"{rel}: could not locate the {fn} regex")
            continue
        # m.group(1) is just the literal; the flags are captured separately, so
        # re-attach them. Without /g only the first mark would be removed and
        # the assertion would be meaningless.
        cls = m.group(1) + m.group(2)
        for raw_in, raw_out in samples:
            # json.dumps produces a valid JS string literal; the \u escapes in
            # the sample table are already decoded by Python.
            js = ("const s=%s;console.log(JSON.stringify(s.replace(%s,'')));"
                  % (json.dumps(raw_in, ensure_ascii=False), cls))
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
                fh.write(js)
                tmp = fh.name
            p = sp.run(["node", tmp], capture_output=True, text=True)
            os.unlink(tmp)
            want = json.dumps(raw_out, ensure_ascii=False)
            if p.stdout.strip() != want:
                bad.append(f"{rel}: {fn} regex mangles {raw_in} -> {p.stdout.strip()} "
                           f"(want {want}). Use \\u escapes, not literal characters.")
                break
    return bad


def check_srs_keys():
    """The SRS card key must have exactly one definition.

    The Vocabulary page and the Progress page each built the string themselves
    and disagreed on the deck component (id vs title), so "cards due" on one page
    could never reconcile with the other. Now the format lives in
    Academy.cardKey and both pages call it; this asserts no page rebuilds it.
    """
    bad = []
    app = open(os.path.join(BASE, "assets", "js", "app.js"), encoding="utf-8").read()
    if "function cardKey(deckId, word)" not in app:
        bad.append("assets/js/app.js: the shared cardKey() helper is missing")
    for rel in ["pages/vocabulary.html", "pages/progress.html"]:
        path = os.path.join(BASE, rel)
        src = open(path, encoding="utf-8").read()
        # Any hand-rolled "X::Y" concatenation is a redefinition.
        for m in re.finditer(r'[^\n]*\+\s*"::"\s*\+[^\n]*', src):
            bad.append(f"{rel}: builds an SRS key by hand -> {m.group(0).strip()[:70]}")
    for rel in ["pages/vocabulary.html", "pages/progress.html"]:
        path = os.path.join(BASE, rel)
        src = open(path, encoding="utf-8").read()
        if "Academy.cardKey" not in src and "Academy.deckKeys" not in src \
                and "Academy.allDeckKeys" not in src:
            bad.append(f"{rel}: never calls the shared Academy key helpers")
    return bad


def main():
    targets = sorted(glob.glob(os.path.join(BASE, "*.html")) +
                     glob.glob(os.path.join(BASE, "pages", "*.html")))
    targets += [os.path.join(BASE, "assets", "js", "*.js"),
                os.path.join(BASE, "sw.js")]
    files = []
    for t in targets:
        files.extend(glob.glob(t) if any(c in t for c in "*?") else [t])

    problems = []
    checked = 0
    tmpdir = tempfile.mkdtemp(prefix="islam-academy-js-")
    for f in files:
        rel = os.path.relpath(f, BASE)
        if f.endswith(".js"):
            scripts = [("", open(f, encoding="utf-8").read())]
        else:
            scripts = [(f"#{i}", b) for i, b in enumerate(blocks(f))]
        for tag, code in scripts:
            if not code.strip():
                continue
            checked += 1
            tmp = os.path.join(tmpdir, "chunk.js")
            with open(tmp, "w", encoding="utf-8") as fh:
                fh.write(code)
            p = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
            if p.returncode != 0:
                first = (p.stderr.strip().splitlines() or ["?"])[0]
                problems.append(f"{rel}{tag}: {first}")

    # Cross-file reference check: every asset/link/fetch target must exist.
    missing = []
    for f in files:
        if not f.endswith(".html"):
            continue
        rel = os.path.relpath(f, BASE)
        src = open(f, encoding="utf-8").read()
        d = os.path.dirname(f)
        for m in re.finditer(r'(?:src|href)="([^"#?]+)"', src):
            u = m.group(1)
            if u.startswith(("http", "data:", "mailto", "//")):
                continue
            if not os.path.exists(os.path.normpath(os.path.join(d, u))):
                missing.append(f"{rel}: <{u}>")

    # Script tag balance. An unbalanced pair does not fail `node --check` (the
    # extracted block is still valid JS) but the browser then parses the
    # following markup as script source, so the page silently does nothing.
    unbalanced = []
    for f in files:
        if not f.endswith(".html"):
            continue
        rel = os.path.relpath(f, BASE)
        src = open(f, encoding="utf-8").read()
        opens = len(re.findall(r"<script\b(?![^>]*\bsrc=)", src))
        closes = len(re.findall(r"</script>", src))
        srcs = len(re.findall(r"<script\b[^>]*\bsrc=", src))
        if opens + srcs != closes:
            unbalanced.append(f"{rel}: {opens} inline + {srcs} src = {opens + srcs} "
                              f"<script, but {closes} </script>")

    print(f"checked {checked} script block(s) across {len(files)} file(s)")
    tashkeel = check_tashkeel_regexes()
    srs = check_srs_keys()
    if problems or missing or tashkeel or unbalanced or srs:
        for x in problems:
            print("  JS  ", x)
        for x in missing:
            print("  LINK", x)
        for x in tashkeel:
            print("  RTL ", x)
        for x in unbalanced:
            print("  TAG ", x)
        for x in srs:
            print("  SRS ", x)
        return 1
    print("All scripts parse, tags balance, links resolve, tashkeel regexes and SRS keys are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
