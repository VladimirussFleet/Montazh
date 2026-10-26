#!/usr/bin/env python3
"""Речь -> слова с таймкодами. Работает офлайн на процессоре.

    python3 scripts/transcribe.py work/<ролик>/src/me.mov work/<ролик>/words.json [--en]

Русский: GigaAM v2 (Сбер, лицензия MIT). Английский (--en): NVIDIA Parakeet TDT 0.6B v2.
words.json = {"text": "...", "words": [["слово", секунда_начала], ...]}
Длинные записи режутся на куски ~25 с по самым тихим местам, чтобы модель не теряла слова.
"""
import sys, numpy as np, sherpa_onnx
from common import RU_MODEL, EN_MODEL, read_audio, save_json

args = [a for a in sys.argv[1:] if not a.startswith("--")]
EN = "--en" in sys.argv
if len(args) < 2:
    raise SystemExit(__doc__)
src, out = args[0], args[1]
d = EN_MODEL if EN else RU_MODEL
if not d.exists():
    raise SystemExit(f"нет модели {d.name}: запусти sh scripts/setup.sh" + (" --en" if EN else ""))
dec = "decoder.int8.onnx" if (d / "decoder.int8.onnx").exists() else "decoder.onnx"
join = "joiner.int8.onnx" if (d / "joiner.int8.onnx").exists() else "joiner.onnx"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=str(d / "encoder.int8.onnx"), decoder=str(d / dec), joiner=str(d / join),
    tokens=str(d / "tokens.txt"), model_type="nemo_transducer", num_threads=4)

SR = 16000
a = read_audio(src, SR)
words, texts, i = [], [], 0
while i < len(a):
    j = min(len(a), i + 25 * SR)
    if j < len(a):  # cut at the quietest 50 ms within the last 5 s of the chunk
        seg = a[j - 5 * SR: j]
        e = np.convolve(seg ** 2, np.ones(800) / 800, "same")
        j = j - 5 * SR + int(np.argmin(e))
    s = rec.create_stream(); s.accept_waveform(SR, a[i:j]); rec.decode_stream(s); r = s.result
    texts.append(r.text.strip())
    cur = None
    for tok, t in zip(r.tokens, r.timestamps):
        if tok.startswith(" ") or tok.startswith("▁") or cur is None:
            cur = [tok.strip(" ▁"), round(i / SR + t, 3)]
            if cur[0] or tok.strip(" ▁") == "":
                words.append(cur)
        else:
            cur[0] += tok
    i = j
words = [w for w in words if w[0]]
save_json(out, {"text": " ".join(texts), "words": words})
print(" ".join(texts))
print(f"\n{len(words)} слов, {len(a)/SR:.1f} с -> {out}")
