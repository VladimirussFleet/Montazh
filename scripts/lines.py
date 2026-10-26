#!/usr/bin/env python3
"""Текст ролика по строкам с номерами и временем: по нему человек решает, что вырезать.

    python3 scripts/lines.py work/<ролик>

Читает src/me.* и words.json, пишет lines.json и печатает таблицу:
  N  начало-конец  длит.  текст
Строка = кусок речи между паузами >= 0.35 с; длинные куски делятся по самой длинной паузе внутри.
Границы строк сразу поставлены в тишину между словами, так что резать по ним можно без «откусанных» слов.
"""
import sys, glob, numpy as np
from common import workdir, load_json, save_json, read_audio, energy_db, speech_mask, brand, PACING

d = workdir(sys.argv[1])
src = sorted(glob.glob(str(d / "src" / "me.*")))
if not src:
    raise SystemExit("положи запись себя в src/me.mov (или .mp4)")
W = load_json(d / "words.json")["words"]
SR = 16000
a = read_audio(src[0], SR)
db = energy_db(a, SR)
sp, floor, thr = speech_mask(db)
T = len(sp) * 0.01


def silence_between(t0, t1):
    i0, i1 = int(t0 * 100), int(t1 * 100)
    seg = sp[i0:i1]
    best = cur = 0
    for s in seg:
        cur = 0 if s else cur + 1
        best = max(best, cur)
    return best * 0.01


def speech_end(t, limit):
    """End of speech after time t: first silent run >= 0.2 s, before `limit`.
    A stop consonant inside a word («чет-вёр-тый») is a short dip, so short silences don't count."""
    i, run = int(t * 100), 0
    while i < min(len(sp), int(limit * 100)):
        run = 0 if sp[i] else run + 1
        if run >= 20:
            return (i - run + 1) * 0.01 + 0.05
        i += 1
    return limit


def speech_start(t, prev_limit):
    """Back off from a word start into the silence before it."""
    i = int(t * 100)
    lo = int(max(prev_limit, t - 0.3) * 100)
    while i > lo and sp[i - 1]:
        i -= 1
    return max(prev_limit, i * 0.01 - 0.04)


# pause after each word (silence before the next word starts)
gaps = [silence_between(W[k][1] + 0.05, W[k + 1][1]) for k in range(len(W) - 1)]


NO_AFTER = {"и", "а", "в", "во", "на", "не", "ни", "по", "о", "об", "к", "с", "со", "у", "из", "за", "для", "от", "до", "кое", "как", "мой", "моя", "мои",
            "the", "a", "an", "to", "of", "and", "in", "on", "for", "my", "your"}
CLAUSE = {"и", "а", "но", "потом", "дальше", "теперь", "если", "когда", "тогда", "так", "вот", "and", "but", "so", "then", "now", "if"}


def score(k):
    """How good it is to break after word k: longer pause is better, never inside 'кое что', 'в чате'."""
    s = gaps[k]
    if W[k][0].lower() in NO_AFTER:
        s -= 1
    if W[k + 1][0].lower() in CLAUSE:
        s += 0.08
    return s


def split(i0, i1):
    """Words i0..i1-1 -> groups. Break at pauses >= 0.35 s; long groups break at their longest pause."""
    cut = [k for k in range(i0, i1 - 1) if gaps[k] >= 0.35]
    if cut:
        out, s0 = [], i0
        for k in cut:
            out += split(s0, k + 1); s0 = k + 1
        return out + split(s0, i1)
    if i1 - i0 > 14:
        k = max(range(i0 + 3, i1 - 4), key=lambda k: score(k))
        return split(i0, k + 1) + split(k + 1, i1)
    return [list(range(i0, i1))]


groups = [[W[k] for k in gr] for gr in split(0, len(W))]

lines, prev_end = [], 0.0
for n, gr in enumerate(groups, 1):
    nxt = groups[n][0][1] if n < len(groups) else T
    st = speech_start(gr[0][1], prev_end)
    last_w, last_t = gr[-1]
    en = speech_end(last_t + min(0.055 * len(last_w), 0.6), nxt - 0.02)  # never inside the last word
    lines.append({"n": n, "start": round(st, 2), "end": round(en, 2), "text": " ".join(w for w, _ in gr)})
    prev_end = en
save_json(d / "lines.json", lines)

pace = PACING.get(brand().get("pacing", "tight"), PACING["tight"])
speech = sum(l["end"] - l["start"] for l in lines)
print(f"фон {floor:.0f} dB, порог речи {thr:.0f} dB, запись {T:.1f} с\n")
for l in lines:
    print(f"{l['n']:3d}  {l['start']:6.2f}-{l['end']:6.2f}  {l['end']-l['start']:4.1f}с  {l['text']}")
print(f"\nречь без пауз между строками: {speech:.1f} с; с темпом {pace['speed']}x примерно {speech/pace['speed']:.0f} с")
