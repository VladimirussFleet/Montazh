#!/usr/bin/env python3
"""Кадры для шаблона: себя (mf/) и записей экрана (rf/<имя>/), 30 кадров в секунду.

    python3 scripts/frames.py work/<ролик>

src/me.*          -> mf/0001.jpg...   1080×1920 (горизонтальное видео обрезается по центру)
src/rec1.mp4 ...  -> rf/rec1/0001.jpg... в родном размере записи
Пишет frames.json (сколько кадров и какой размер) — его читает render.py. Повторный запуск пропускает готовое.
"""
import sys, glob, json, pathlib, subprocess
from common import workdir, save_json, load_json

d = workdir(sys.argv[1])
info = load_json(d / "frames.json", {"me": None, "rec": {}})


def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration",
                        "-of", "json", f], capture_output=True, text=True)
    return json.loads(r.stdout)


def sig(f):
    """Same name is not enough: a replaced file (new take, re-rendered motion) must be extracted again."""
    st = pathlib.Path(f).stat()
    return f"{st.st_size}:{int(st.st_mtime)}"


def extract(f, out, vf):
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.jpg"):
        old.unlink()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", vf, "-q:v", "3", str(out / "%04d.jpg")], check=True)
    return len(list(out.glob("*.jpg")))


me = sorted(glob.glob(str(d / "src" / "me.*")))
if me:
    m = info.get("me") or {}
    if m.get("file") != me[0] or m.get("sig") != sig(me[0]) or not (d / "mf" / "0001.jpg").exists():
        n = extract(me[0], d / "mf", "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920")
        info["me"] = {"file": me[0], "n": n, "fps": 30, "sig": sig(me[0])}
    print("me:", info["me"]["n"], "кадров")

for f in sorted(glob.glob(str(d / "src" / "rec*.*"))):
    name = pathlib.Path(f).stem
    r = info["rec"].get(name) or {}
    if r.get("file") == f and r.get("sig") == sig(f) and (d / "rf" / name / "0001.jpg").exists():
        print(name, info["rec"][name]["n"], "кадров (готово)"); continue
    n = extract(f, d / "rf" / name, "fps=30")
    from PIL import Image
    w, h = Image.open(d / "rf" / name / "0001.jpg").size
    info["rec"][name] = {"file": f, "n": n, "w": w, "h": h, "fps": 30, "sig": sig(f)}
    print(name, n, "кадров", f"{w}×{h}")
save_json(d / "frames.json", info)
