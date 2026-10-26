#!/usr/bin/env python3
"""Вырезать лишнее, сжать паузы и ускорить речь без «робота» и без задвоения голоса.

    python3 scripts/cut.py work/<ролик> [--check]

cut.json (пишет Claude после того, как человек согласовал строки):
{
  "keep": [1, 2, 4, [20.32, 24.83], {"line": 9, "from": 1}],   # в порядке показа; можно переставлять
  "cuts": [[16.62, 16.96]],          # необязательно: ещё куски внутри оставленного (вдох, «э-э»)
  "pacing": "tight",                 # natural | tight | fast; по умолчанию из brand.json
  "speed": null                      # своё ускорение, например 1.1; null = из pacing
}
  число         -> строка из lines.json целиком
  [a, b]        -> кусок исходника в секундах
  {"line": n, "from": i, "to": j} -> строка n со слова i до слова j (с нуля, j не включая)

На выходе: vo.wav (голос) и edit.json {pieces, words, dur}.
pieces связывают время готового ролика с кадрами исходника, поэтому губы совпадают со звуком.
words: [слово, время в ролике, время в исходнике, номер слова в words.json].
--check заново распознаёт готовый голос и показывает слова, которые могли «откуситься» на стыках.
"""
import sys, glob, subprocess, tempfile, os, numpy as np
from common import (workdir, load_json, save_json, read_audio, write_wav, energy_db, speech_mask,
                    silent_runs, brand, PACING)

d = workdir(sys.argv[1])
C = load_json(d / "cut.json")
src = sorted(glob.glob(str(d / "src" / "me.*")))[0]
words = load_json(d / "words.json")["words"]
lines = {l["n"]: l for l in load_json(d / "lines.json", [])}
B = brand()
pace = dict(PACING[C.get("pacing") or B.get("pacing") or "tight"])
speed = float(C.get("speed") or B.get("speed") or pace["speed"])

SR = 48000
A = read_audio(src, SR)
a16 = read_audio(src, 16000)
db = energy_db(a16, 16000)
sp, floor, thr = speech_mask(db)


def quiet_point(t, lo, hi):
    """Quietest 10 ms frame in [t+lo, t+hi]."""
    i0, i1 = max(0, int((t + lo) * 100)), min(len(db), int((t + hi) * 100) + 1)
    if i1 <= i0:
        return t
    return (i0 + int(np.argmin(db[i0:i1]))) * 0.01


def line_span(e):
    if isinstance(e, int):
        l = lines[e]; return [l["start"], l["end"]]
    if isinstance(e, list):
        return [quiet_point(e[0], -0.06, 0.03), quiet_point(e[1], -0.03, 0.06)]
    l = lines[e["line"]]
    ws = [w for w in words if l["start"] - 0.01 <= w[1] < l["end"]]
    i, j = e.get("from", 0), e.get("to", len(ws))
    a = l["start"] if i == 0 else quiet_point(ws[i][1], -0.12, 0.0)
    b = l["end"] if j >= len(ws) else quiet_point(ws[j][1], -0.12, 0.0)
    return [a, b]


spans = [line_span(e) for e in C["keep"]]
# glue spans that follow each other in the source when no word starts between them
# (the gap is a pause or the tail of the last word; long pauses are shortened below anyway)
blocks = []
for a, b in spans:
    if blocks and -0.03 < a - blocks[-1][1] < 1.5 and not any(blocks[-1][1] + 0.02 < w[1] < a - 0.02 for w in words):
        blocks[-1][1] = b
    else:
        blocks.append([a, b])

# shorten long pauses inside blocks + explicit cuts
pieces = []
for a, b in blocks:
    i0, i1 = int(a * 100), int(b * 100)
    holes = []
    for s0, s1 in silent_runs(sp[i0:i1], 0.01, pace["max_pause"]):
        s0 += a; s1 += a
        if s0 - a < 0.05 or b - s1 < 0.05:
            continue  # edges are handled by line boundaries
        k = pace["keep_pause"] / 2
        holes.append([s0 + k, s1 - k])
    holes += [c for c in C.get("cuts", []) if a < c[0] < b]
    holes.sort()
    cur = a
    for h0, h1 in holes:
        if h0 > cur + 0.02:
            pieces.append([cur, h0])
        cur = max(cur, h1)
    if b > cur + 0.02:
        pieces.append([cur, b])

# audio: join pieces with short fades, then one uniform stretch (R3 engine, formants kept)
out, P, O = [], [], 0.0
f = int(0.006 * SR)
for a, b in pieces:
    y = A[int(a * SR): int(b * SR)].copy()
    if len(y) > 2 * f:
        y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    out.append(y)
    n = len(y) / SR
    P.append({"src0": round(a, 4), "src1": round(b, 4), "speed": speed, "out0": round(O / speed, 4), "out1": round((O + n) / speed, 4)})
    O += n
cut = np.concatenate(out)
tmp = tempfile.mkdtemp()
write_wav(f"{tmp}/cut.wav", cut, SR)
if abs(speed - 1) > 1e-3:
    subprocess.run(["rubberband", "-3", "--formant", "-q", "-T", str(speed), f"{tmp}/cut.wav", f"{tmp}/st.wav"], check=True, capture_output=True)
    y = read_audio(f"{tmp}/st.wav", SR)
else:
    y = cut
n = int(round(len(cut) / speed))
y = np.pad(y, (0, max(0, n - len(y))))[:n]
write_wav(d / "vo.wav", y, SR)


def s2o(t):
    for q in P:
        if q["src0"] - 0.06 <= t <= q["src1"]:
            return q["out0"] + max(0, t - q["src0"]) / q["speed"]
    for q in P:  # the recogniser often stamps a word a little early, inside the pause we shortened
        if 0 < q["src0"] - t < 0.4:
            return q["out0"]
    return None


W = []
for k, (w, t) in enumerate(words):
    o = s2o(t)
    if o is not None:
        W.append([w, round(o, 3), t, k])  # word, time in the reel, time in the source, index in words.json
dur = round(n / SR, 3)
save_json(d / "edit.json", {"pieces": P, "words": W, "dur": dur, "speed": speed})
src_len = len(A) / SR
print(f"{len(P)} кусков, темп {speed}x: {src_len:.1f} с -> {dur:.1f} с")
print(" ".join(x[0] for x in W))

if "--check" in sys.argv:
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "transcribe.py"), str(d / "vo.wav"), f"{tmp}/chk.json"], check=True, capture_output=True)
    got = [w for w, _ in load_json(f"{tmp}/chk.json")["words"]]
    exp = [x[0] for x in W]
    import difflib
    sm = difflib.SequenceMatcher(a=exp, b=got)
    bad = [(op, exp[i1:i2], got[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    print("\nпроверка стыков:", "всё на месте" if not bad else "")
    for op, e, g in bad:
        print(f"  ожидалось «{' '.join(e)}» -> слышно «{' '.join(g)}»")
