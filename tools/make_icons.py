#!/usr/bin/env python3
"""Generate the PWA icon set from the bundled Amiri Quran font.

The manifest needs real raster icons: a data-URI SVG is not accepted by every
browser, and a maskable variant is required for a clean Android install.

The Arabic letter is drawn with the font already vendored in assets/fonts, so
no network access or external rasteriser is needed.

Run:  python3 tools/make_icons.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont
from PIL.Image import Resampling

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "icons")
FONT = os.path.join(BASE, "assets", "fonts", "AmiriQuran-Regular.ttf")

EMERALD_DARK = (11, 61, 46)
EMERALD = (20, 83, 45)
EMERALD_LIGHT = (29, 107, 63)
GOLD_TOP = (230, 200, 96)
GOLD_BOTTOM = (201, 162, 39)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _ramp(length, stops):
    """A 1-D gradient strip through `stops` = [(t, rgb), ...]."""
    strip = Image.new("RGB", (length, 1))
    px = strip.load()
    assert px is not None
    lo, hi = stops[0], stops[-1]
    for x in range(length):
        t = x / (length - 1)
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            if a[0] <= t <= b[0]:
                lo, hi = a, b
                break
        span_t = 0.0 if hi[0] == lo[0] else (t - lo[0]) / (hi[0] - lo[0])
        px[x, 0] = lerp(lo[1], hi[1], span_t)
    return strip


def diagonal_gradient(size, stops):
    """Diagonal gradient, built small and scaled up — a per-pixel loop over
    512x512 in pure Python costs seconds and shows no visible difference."""
    n = 128
    strip = _ramp(n, stops)
    return strip.resize((size, size), Resampling.BILINEAR)


def vertical_gradient(size, top, bottom):
    return _ramp(size, [(0.0, top), (1.0, bottom)]).resize((size, size))


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_icon(size, maskable=False):
    img = diagonal_gradient(size, [(0.0, EMERALD_DARK), (0.55, EMERALD), (1.0, EMERALD_LIGHT)])

    d = ImageDraw.Draw(img, "RGBA")
    # Outer gold rule. A maskable icon is cropped to a circle by the launcher,
    # so its safe zone is a smaller inset.
    inset = int(size * (0.20 if maskable else 0.035))
    d.rounded_rectangle(
        [inset, inset, size - 1 - inset, size - 1 - inset],
        radius=int(size * (0.18 if maskable else 0.18)),
        outline=GOLD_TOP + (150,),
        width=max(1, size // 170),
    )

    # Eight-pointed khatam star behind the letter.
    cx = cy = size / 2
    r_out = size * 0.335
    r_in = r_out * 0.415
    pts = []
    for i in range(16):
        import math
        ang = math.pi / 2 + i * math.pi / 8
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(ang), cy - r * math.sin(ang)))
    d.polygon(pts, outline=GOLD_TOP + (52,), width=max(1, size // 200))

    # The letter qaf.
    glyph = "ق"
    px = int(size * (0.50 if maskable else 0.545))
    font = ImageFont.truetype(FONT, px)
    bbox = font.getbbox(glyph)
    gw, gh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # Optical centring: the font's ascent box is taller than the glyph itself.
    draw_x = cx - gw / 2 - bbox[0]
    draw_y = cy - gh / 2 - bbox[1] + size * 0.02
    d.text((draw_x, draw_y), glyph, font=font, fill=GOLD_TOP)

    if not maskable:
        img.putalpha(rounded_mask(size, int(size * 0.205)))
    else:
        # Fully bleed to the edges so the launcher's crop never shows a seam.
        img.putalpha(255)
    return img


def main():
    if not os.path.exists(FONT):
        print("missing font:", FONT)
        return 1
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable.png", 512, True),
    ]
    for name, size, maskable in jobs:
        img = make_icon(size, maskable)
        path = os.path.join(OUT, name)
        img.save(path, "PNG", optimize=True)
        print(f"wrote {name}  {size}x{size}  {os.path.getsize(path) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
