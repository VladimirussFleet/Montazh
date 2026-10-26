#!/usr/bin/env python3
"""Звук ролика: обработанный голос + тихие звуки на события таймлайна (+ музыка, если выбрана) -> mix.wav.

    python3 scripts/mix.py work/<ролик>

Громкость звуков: brand.json "sfx": none | subtle | lots.
Музыка: файл src/music.* в папке ролика, иначе brand.json "music": {"file": "brand/music.mp3", "below_db": 18, "duck_db": 6}.
Без файла музыки нет: трендовый трек обычно ставят в Instagram при публикации.
Как обрабатывается голос — в шапке scripts/audio.py.
"""
import sys, glob
from common import ROOT, workdir, load_json, brand
from audio import SR, voice, sfx_track, music_bed, mixdown, write_stereo

d = workdir(sys.argv[1])
TL, B = load_json(d / "tl.json"), brand()
N = int(TL["end"] * SR)
v, I = voice(d / "vo.wav", (B.get("audio") or {}).get("denoise", False))
S = sfx_track(TL, B, N)
M = None
mus = B.get("music") or {}
track = sorted(glob.glob(str(d / "src" / "music.*")))
# a track sent for this reel always plays; the brand track only when music is switched on in the style
track = track[0] if track else (str(ROOT / mus["file"]) if mus.get("enabled") and mus.get("file") else None)
if track:
    M = music_bed(track, N, v, mus.get("below_db", 18), mus.get("duck_db", 6))
out = mixdown(v, N, S, B.get("sfx", "subtle"), M)
write_stereo(d / "mix.wav", out)
import numpy as np
print(f"mix.wav: голос {I:.1f} -> -14 LUFS (стерео), пик {20 * np.log10(np.abs(out).max()):.1f} dB, звуки {B.get('sfx', 'subtle')}"
      f"{', музыка: ' + track.split('/')[-1] if track else ''}, {len(out) / SR:.1f} с")
