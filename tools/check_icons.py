#!/usr/bin/env python3
"""Verify the generated icons contain a real Arabic glyph, not a tofu box.

PIL falls back to a .notdef rectangle when a font lacks a codepoint, and that
failure is invisible in code review but very visible on a home screen. This
asserts the glyph is present in the font cmap and that each rendered icon has a
sensible amount of gold foreground, which catches both a blank icon and a
solid block.

Run:  python3 tools/check_icons.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(BASE, "assets", "icons")
FONT = os.path.join(BASE, "assets", "fonts", "AmiriQuran-Regular.ttf")
GLYPH = "ق"  # qaf — the academy's mark

MIN_INK = 0.015  # total gold (rules + star + glyph) across the whole tile
MAX_INK = 0.60   # more than this means the glyph filled the tile
MIN_CENTRE = 0.04  # gold inside the middle half, i.e. the letter itself


def _gold_mask(img):
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    return rgb, px, w, h


def gold_ratio(img, box=None):
    """Fraction of sampled pixels close to the gold foreground."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    x0, y0, x1, y1 = box or (0, 0, w, h)
    total = 0
    n = 0
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            r, g, b = px[x, y]
            total += 1
            if r > 150 and g > 110 and b < 140 and r - b > 60:
                n += 1
    return n / float(total or 1)


def centre_ratio(img):
    """Gold in the middle half of the tile — the letter lives here, so this
    distinguishes 'a faint decorative rule only' from 'a rendered glyph'."""
    w, h = img.size
    return gold_ratio(img, (w // 4, h // 4, w * 3 // 4, h * 3 // 4))


def glyph_ink(font):
    """Non-zero pixel count when the font renders the glyph."""
    img = Image.new("L", (200, 200), 0)
    d = ImageDraw.Draw(img)
    d.text((100, 100), GLYPH, font=font, fill=255, anchor="mm")
    hist = img.histogram()
    return sum(hist[10:])


def main():
    if not os.path.exists(FONT):
        print("missing font:", FONT)
        return 1
    problems = []

    # 1. Does the font actually carry the codepoint?
    font = ImageFont.truetype(FONT, 120)
    if glyph_ink(font) < 200:
        problems.append(
            f"{os.path.basename(FONT)} renders U+{ord(GLYPH):04X} as blank or a "
            f"box (ink={glyph_ink(font)}) — the cmap has no real glyph")

    # 2. Does each icon have plausible gold coverage?
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("icon-maskable.png", 512)]:
        path = os.path.join(ICONS, name)
        if not os.path.exists(path):
            problems.append(f"{name}: missing (run tools/make_icons.py)")
            continue
        img = Image.open(path)
        if img.width != img.height or img.width != size:
            problems.append(f"{name}: expected {size}x{size}, got {img.width}x{img.height}")
        if img.mode not in ("RGB", "RGBA"):
            problems.append(f"{name}: unexpected mode {img.mode}")
        if img.mode == "RGBA":
            lo, hi = img.getchannel("A").getextrema()
            if lo == 0 and hi == 0:
                problems.append(f"{name}: fully transparent")
        ratio = gold_ratio(img)
        centre = centre_ratio(img)
        if not (MIN_INK <= ratio <= MAX_INK):
            problems.append(f"{name}: gold coverage {ratio:.1%} outside "
                            f"{MIN_INK:.1%}–{MAX_INK:.0%} — glyph did not render")
        if centre < MIN_CENTRE:
            problems.append(f"{name}: only {centre:.1%} gold in the centre "
                            f"(need {MIN_CENTRE:.0%}) — the letter is missing")
        print(f"  {name:22s} {img.width}x{img.height}  {img.mode:4s}  "
              f"gold={ratio:.1%}  centre={centre:.1%}")

    if not os.path.exists(os.path.join(ICONS, "icon.svg")):
        problems.append("icon.svg: missing")

    if problems:
        print()
        for p in problems:
            print("  -", p)
        return 1
    print(f"\nU+{ord(GLYPH):04X} renders in the font; all icons have sane coverage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
