#!/usr/bin/env python3
"""Проверка, что всё на месте. Последняя строка: ГОТОВО или чего не хватает.

    python3 scripts/doctor.py
"""
import shutil, subprocess, importlib.util
from common import ROOT, RU_MODEL, EN_MODEL

ok, bad = [], []
def chk(name, cond, fix):
    (ok if cond else bad).append((name, fix))

chk("ffmpeg", shutil.which("ffmpeg"), "sh scripts/setup.sh")
chk("rubberband", shutil.which("rubberband"), "apt-get install rubberband-cli (Mac: brew install rubberband)")
chk("node/npm", shutil.which("npm"), "установить Node.js")
chk("шрифты", (ROOT / "node_modules/@fontsource/montserrat").exists(), "npm install")
for m in ("sherpa_onnx", "numpy", "PIL", "playwright"):
    chk(f"python: {m}", importlib.util.find_spec(m) is not None, "sh scripts/setup.sh")
chk("модель русской речи", (RU_MODEL / "encoder.int8.onnx").exists(), "sh scripts/setup.sh")
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        p.chromium.launch().close()
    chk("Chromium", True, "")
except Exception:
    chk("Chromium", False, "python3 -m playwright install chromium")
emoji = subprocess.run(["fc-list"], capture_output=True, text=True).stdout if shutil.which("fc-list") else ""
brand = (ROOT / "brand" / "brand.json").exists()

for n, _ in ok:
    print("  ✓", n)
for n, fix in bad:
    print("  ✗", n, "→", fix)
print("  · английская модель:", "есть" if (EN_MODEL / "encoder.int8.onnx").exists() else "нет (нужна только для английских роликов: setup.sh --en)")
print("  · эмодзи в шрифтах:", "есть" if "Emoji" in emoji else "не найдены (эмодзи в хуке могут не нарисоваться)")
print("  · стиль:", "скачан со страницы" if brand else "возьми со страницы «Монтажный стол» (brand_sync.py pull) или, если её нет, проведи интервью")
print("ГОТОВО" if not bad else "НЕ ХВАТАЕТ: " + ", ".join(n for n, _ in bad))
