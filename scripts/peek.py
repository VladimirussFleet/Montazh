#!/usr/bin/env python3
"""Посмотреть записи экрана с координатной сеткой, чтобы задать crop, blur, taps и рамки в plan.json.

    python3 scripts/peek.py work/<ролик> rec1 2.0,7.5,12        # кадры записи на этих секундах -> peek_rec1.jpg
    python3 scripts/peek.py work/<ролик> me 1,5,9                # то же для записи себя (лицо, поза)
    python3 scripts/peek.py work/<ролик> rec1 sheet              # каждые 2 с всей записи

Сетка: линии каждые 100 px, подписи каждые 200 px — в координатах самой записи (как в plan.json).
"""
import sys
from PIL import Image, ImageDraw, ImageFont
from common import workdir, load_json

d, name, arg = workdir(sys.argv[1]), sys.argv[2], sys.argv[3]
FR = load_json(d / "frames.json")
info = FR["me"] if name == "me" else FR["rec"][name]
folder = d / ("mf" if name == "me" else f"rf/{name}")
n, fps = info["n"], info.get("fps", 30)
ts = [round(i * 2.0, 1) for i in range(int(n / fps / 2) + 1)] if arg == "sheet" else [float(x) for x in arg.split(",")]
tiles = []
try:
    FONT = ImageFont.load_default(size=44)
except TypeError:
    FONT = ImageFont.load_default()
for t in ts:
    k = min(n, max(1, round(t * fps) + 1))
    im = Image.open(folder / f"{k:04d}.jpg").convert("RGB")
    W, H = im.size
    dr = ImageDraw.Draw(im)
    for y in range(0, H, 100):
        dr.line([(0, y), (W, y)], fill=(255, 0, 80) if y % 200 == 0 else (255, 160, 180), width=2 if y % 200 == 0 else 1)
        if y % 200 == 0:
            dr.rectangle([0, y, 120, y + 52], fill=(255, 0, 80)); dr.text((6, y + 4), str(y), fill="white", font=FONT)
    for x in range(0, W, 100):
        dr.line([(x, 0), (x, H)], fill=(0, 140, 255) if x % 200 == 0 else (150, 200, 255), width=2 if x % 200 == 0 else 1)
        if x % 200 == 0 and x:
            dr.rectangle([x, 0, x + 110, 50], fill=(0, 140, 255)); dr.text((x + 6, 3), str(x), fill="white", font=FONT)
    dr.rectangle([W - 330, H - 70, W, H], fill="black"); dr.text((W - 320, H - 62), f"{name} {t:.1f}s", fill="white", font=FONT)
    tiles.append(im.resize((W * 640 // H, 640)))
cols = min(6, len(tiles))
tw, th = tiles[0].size
sheet = Image.new("RGB", (tw * cols, th * ((len(tiles) + cols - 1) // cols)), "#222")
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
out = d / f"peek_{name}.jpg"
sheet.save(out, quality=85)
print(out, f"({len(tiles)} кадров, запись {info.get('w', 1080)}×{info.get('h', 1920)})")
