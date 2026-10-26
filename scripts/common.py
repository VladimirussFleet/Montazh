"""Shared helpers for the montazh scripts (paths, brand, audio, speech energy)."""
import json, os, pathlib, re, subprocess, tempfile, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
RU_MODEL = MODELS / "sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19"
EN_MODEL = MODELS / "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"

# pacing presets: speed of speech, pauses longer than max_pause are shortened to keep_pause
PACING = {
    "natural": {"speed": 1.00, "max_pause": 0.55, "keep_pause": 0.30},
    "tight":   {"speed": 1.08, "max_pause": 0.30, "keep_pause": 0.16},
    "fast":    {"speed": 1.12, "max_pause": 0.20, "keep_pause": 0.10},
}


def workdir(arg):
    d = pathlib.Path(arg)
    if not d.is_absolute():
        d = (pathlib.Path.cwd() / d) if (pathlib.Path.cwd() / d).exists() else ROOT / d
    d = d.resolve()
    if not d.exists():
        raise SystemExit(f"нет папки {d}")
    return d


def rel(d):
    """Path of a work folder relative to the repo root (the http server root)."""
    return str(pathlib.Path(d).resolve().relative_to(ROOT))


def load_json(p, default=None):
    p = pathlib.Path(p)
    if not p.exists():
        if default is not None:
            return default
        raise SystemExit(f"нет файла {p}")
    return json.load(open(p, encoding="utf-8"))


def save_json(p, data):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def brand():
    b = ROOT / "brand" / "brand.json"
    return load_json(b) if b.exists() else {}


def read_audio(src, sr=16000):
    """Decode any media file to mono float32 at sr."""
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", str(sr), tmp], check=True)
    w = wave.open(tmp)
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    os.remove(tmp)
    return a


def write_wav(p, x, sr):
    with wave.open(str(p), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
        f.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def energy_db(a, sr, hop_s=0.01):
    hop = int(sr * hop_s)
    n = len(a) // hop
    return 20 * np.log10(np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)


def speech_mask(db, above=12.0):
    """True where someone is speaking. Threshold sits just above this clip's own background noise."""
    floor = np.percentile(db, 10)
    thr = min(floor + above, np.percentile(db, 90) - 10)
    return db > thr, floor, thr


def silent_runs(mask, hop_s=0.01, min_s=0.15):
    runs, start = [], None
    for i, s in enumerate(list(mask) + [True]):
        if not s and start is None:
            start = i
        if s and start is not None:
            if (i - start) * hop_s >= min_s:
                runs.append((start * hop_s, i * hop_s))
            start = None
    return runs


# частые ошибки распознавания -> как писать в субтитрах (brand.json "fixes" добавляет свои)
BASE_FIX = {"чат джипяти": "ChatGPT", "чат джипити": "ChatGPT", "чаджипяти": "ChatGPT", "чаджипити": "ChatGPT", "чаджи пяти": "ChatGPT",
       "чат жи пяти": "ChatGPT", "чат джи пяти": "ChatGPT", "чат гпт": "ChatGPT", "чатгпт": "ChatGPT", "чат джипити": "ChatGPT",
       "клод": "Claude", "клоуд": "Claude", "клауд": "Claude", "миджорни": "Midjourney", "мидджорни": "Midjourney",
       "чик лист": "чек-лист", "чек лист": "чек-лист", "чеклист": "чек-лист", "кое что": "кое-что", "кое как": "кое-как",
       "по моему": "по-моему", "из за": "из-за", "из под": "из-под", "инстаграм": "Instagram", "ютуб": "YouTube",
       "телеграм": "Telegram", "ии": "ИИ", "гугл": "Google", "айфон": "iPhone"}


def latin_name_idx(words):
    """Indices of words that make up ChatGPT/Claude/... (they get the accent colour by default)."""
    out = set(); low = [w[0].lower() for w in words]
    for i in range(len(low)):
        for n in (3, 2, 1):
            key = " ".join(low[i:i + n])
            if len(low[i:i + n]) == n and key in BASE_FIX and re.match(r"^[A-Z]", BASE_FIX[key]):
                out.update(range(i, i + n)); break
    return sorted(out)
