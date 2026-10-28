#!/usr/bin/env python3
"""Маска человека на каждом кадре: текст и графика «за головой», замена фона, свечение вокруг.

    python3 scripts/cutout.py work/<ролик>

Пишет work/<ролик>/mk/0001.jpg… (белое — человек, 540×960) и отмечает их в frames.json.
Шаблон сам рисует человека поверх карточек с "behind": true и поверх фона из plan.json "cutout".
Модель Robust Video Matting (mobilenetv3, автор PeterL1n, лицензия GPL-3.0) скачивается с GitHub автора
в models/ при первом запуске. Работает на процессоре: примерно минута на 20–30 секунд видео.
"""
import sys, glob, json, subprocess, pathlib, time
import numpy as np
from common import ROOT, workdir, load_json, save_json

d = workdir(sys.argv[1])
MODEL = ROOT / "models" / "rvm_mobilenetv3_fp32.onnx"
URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"
if not MODEL.exists():
    MODEL.parent.mkdir(exist_ok=True)
    print("качаю модель вырезания (15 МБ)…")
    subprocess.run(["curl", "-sSL", "-o", str(MODEL), URL], check=True)
try:
    import onnxruntime as ort
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--break-system-packages", "onnxruntime"], check=True)
    import onnxruntime as ort
from PIL import Image

src = sorted(glob.glob(str(d / "src" / "me.*")))[0]
W, H, FPS = 540, 960, 30
out = d / "mk"
out.mkdir(exist_ok=True)
for f in out.glob("*.jpg"):
    f.unlink()
so = ort.SessionOptions()
so.intra_op_num_threads = 0
sess = ort.InferenceSession(str(MODEL), so, providers=["CPUExecutionProvider"])
rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
ratio = np.array([0.4], np.float32)
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf",
                      f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
n, t0 = 0, time.time()
while True:
    buf = p.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    x = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ratio})
    n += 1
    Image.fromarray((np.clip(pha[0, 0], 0, 1) * 255).astype(np.uint8), "L").save(out / f"{n:04d}.jpg", quality=88)
    if n % 150 == 0:
        print(f"  {n} кадров, {(time.time() - t0) / n * 1000:.0f} мс на кадр", flush=True)
p.wait()
FR = load_json(d / "frames.json", {"me": None, "rec": {}})
FR["mask"] = {"n": n, "w": W, "h": H, "fps": FPS}
save_json(d / "frames.json", FR)
print(f"маски: {n} кадров -> {out}")
