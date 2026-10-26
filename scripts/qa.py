#!/usr/bin/env python3
"""Проверка готового ролика перед отправкой.

    python3 scripts/qa.py work/<ролик> [final.mp4]

Смотрит: размер кадра и файла, длительность, громкость (около -14 LUFS, пик не выше -1 dB),
предупреждения шаблона (слишком длинный текст, пропавшие картинки и шрифты),
и синхрон губ на кусках без сплита и карточек (лаг 0 или ±1 кадр — норма).
"""
import sys, re, json, subprocess, numpy as np
from common import workdir, load_json, brand

d = workdir(sys.argv[1])
f = d / (sys.argv[2] if len(sys.argv) > 2 else "final.mp4")
B = brand()
problems = []
info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,codec_type:format=duration,size", "-of", "json", str(f)],
                                 capture_output=True, text=True).stdout)
v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
dur, size = float(info["format"]["duration"]), int(info["format"]["size"]) / 1e6
print(f"кадр {v['width']}×{v['height']}, {dur:.1f} с, {size:.1f} МБ")
if (v["width"], v["height"]) != (1080, 1920):
    problems.append("кадр не 1080×1920")
if size > 30:
    problems.append(f"файл {size:.0f} МБ — больше 30 МБ, пережать: sh scripts/finish.sh hq.mp4 final.mp4 3800")
mx = B.get("max_seconds")
if mx and dur > mx + 1:
    problems.append(f"ролик длиннее {mx} с из brand.json")
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); P = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
print(f"громкость {I:.1f} LUFS, пик {P:.1f} dB")
if not -16.5 <= I <= -12.5:
    problems.append(f"громкость {I:.1f} LUFS, нужно около -14")
if P > -0.5:
    problems.append("пик почти 0 dB, возможны щелчки")
log = d / "render.log"
if log.exists():
    w = sorted(set(l for l in log.read_text(encoding="utf-8").splitlines() if l.startswith("WARN") or l.startswith("ERR")))
    for l in w:
        print("шаблон:", l)
    problems += [l for l in w if l.startswith("ERR")]

# lip sync: longest stretch without split and cards, mouth area from brand.face_y
tl = load_json(d / "tl.json")
busy = [(a, b + 0.3) for a, b in tl.get("split", [])] + [(c["t"][0], c["t"][1] + 0.3) for c in tl.get("cards", [])] + [(0, 2.8)]
free, t = [], 0.0
for a, b in sorted(busy) + [(dur, dur)]:
    if a - t > 2.5:
        free.append((t, a))
    t = max(t, b)
if free:
    a, b = max(free, key=lambda x: x[1] - x[0])
    fy = B.get("face_y", 740)
    x, y, w, h = 380, fy + 230, 320, 220
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-to", str(b), "-i", str(f), "-vf", f"crop={w}:{h}:{x}:{y},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    mo = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(float).std((1, 2))
    au = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-to", str(b), "-i", str(f), "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], capture_output=True).stdout, np.int16).astype(float)
    hop = 1600; n = len(au) // hop; env = np.log(np.sqrt((au[:n * hop].reshape(n, hop) ** 2).mean(1)) + 10)
    m = min(len(mo), len(env)); mo, env = mo[:m], env[:m]; k = np.ones(15) / 15
    mo = mo - np.convolve(mo, k, "same"); env = env - np.convolve(env, k, "same"); mo /= mo.std() + 1e-9; env /= env.std() + 1e-9
    lag = max(range(-8, 9), key=lambda l: np.mean(mo[max(0, l):m + min(0, l)] * env[max(0, -l):m - max(0, l)]))
    print(f"губы/звук на {a:.1f}-{b:.1f} с: сдвиг {lag} кадров")
    if abs(lag) > 1:
        problems.append(f"возможный рассинхрон губ ({lag} кадров) — посмотреть глазами; если рот закрыт графикой, это ложная тревога")
print("ПРОВЕРКА ПРОЙДЕНА" if not problems else "ПОПРАВИТЬ:\n  " + "\n  ".join(problems))
