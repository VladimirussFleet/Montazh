"""Звук: обработка голоса, синтезированные звуки графики, музыка под голосом. Используют mix.py и style.py.

Голос: срез гула, мягкая и жёсткая компрессия (без сатурации — она даёт «зажаренный» звук),
-17 LUFS в моно = -14 LUFS в стерео (уровень Instagram/TikTok), пики держит лимитер.
Звуки синтезируются здесь же, никаких скачанных библиотек: поп, клик, вжух, тик, дзынь, перемотка.
Музыка (если есть трек): на ~18 dB тише голоса и сама приглушается ещё сильнее, когда человек говорит.
"""
import re, subprocess, tempfile, numpy as np
from common import read_audio

SR = 48000
SFX_LEVEL = {"none": 0.0, "subtle": 0.05, "lots": 0.075}
rng = np.random.default_rng(11)
tt = lambda dur: np.arange(int(dur * SR)) / SR


def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X, len(x))


def tick(p=1.0):
    t = tt(0.025); return bp(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 260) * 0.6 + np.sin(2 * np.pi * 3800 * p * t) * np.exp(-t * 400) * 0.25
def pop(f0=1100, f1=320):
    t = tt(0.12); f = f1 + (f0 - f1) * np.exp(-t * 45); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
def ding(f=1568, dur=1.2):
    t = tt(dur); return (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t * 3)) * np.exp(-t * 4.5) * np.minimum(t / 0.003, 1)
def whoosh(dur=0.35, lo=300, hi=4000):
    t = tt(dur); n = rng.standard_normal(len(t)); out = np.zeros(len(t)); seg = int(0.03 * SR)
    for i in range(0, len(t), seg):
        c = lo + (hi - lo) * np.sin(np.pi * i / len(t)); s = n[i:i + seg]
        if len(s) > 64:
            out[i:i + len(s)] = bp(s, c * 0.5, c * 1.6)
    return out * np.sin(np.pi * t / dur) ** 2 * 0.7
def shimmer(dur):
    t = tt(dur); return bp(rng.standard_normal(len(t)), 3000, 12000) * 0.15 * np.sin(np.pi * t / dur)
def click():
    t = tt(0.04); return bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 180) * 0.9 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 250) * 0.3
def rewind(dur):
    t = tt(dur); f = 900 + 1400 * (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 * np.sin(np.pi * t / dur) + bp(rng.standard_normal(len(t)), 2000, 7000) * 0.15 * np.sin(np.pi * t / dur)


def sfx_track(TL, B, N):
    """All interface sounds for a timeline, normalised to 0.9 peak."""
    S = np.zeros(N)

    def put(t, sig, gain=1.0):
        i = int(t * SR)
        if 0 <= i < N:
            n = min(len(sig), N - i); S[i:i + n] += sig[:n] * gain
    if (TL.get("hook") or {}).get("lines"):
        put(0.02, pop(), 0.6)
    for a, b in TL.get("split", []):
        if a > 0.05:
            put(a - 0.04, whoosh(0.42), 0.65)
        put(b - 0.04, whoosh(0.42), 0.6)
    for k, st in enumerate(TL.get("steps", [])):
        if k > 0:
            put(st[0] - 0.05, whoosh(0.3, 400, 5000), 0.45)
        put(st[0] + 0.02, pop(1200, 600), 0.45)
    for tp in TL.get("taps", []):
        put(tp[0], click(), 0.9)
    for h in TL.get("hl", []):
        put(h[0] + 0.05, pop(1600, 800), 0.4)
    for sh in TL.get("shots", []):
        if sh.get("img"):
            a = sh["t"][0]; put(a - 0.02, shimmer(0.5), 0.9); put(a, pop(), 0.7); put(a + 0.03, ding(), 0.55)
        elif sh.get("ff"):
            a, b = sh["m"][0][0], sh["m"][-1][0]; put(a, rewind(b - a), 0.5)
    for c in TL.get("cards", []):
        a, b = c["t"]; ty = c.get("type")
        put(a, pop(), 0.7)
        if ty in ("image", "number"):
            put(a + 0.03, ding(), 0.45)
        if ty == "number":
            for j in range(10):
                put(a + j * 0.07, tick(1.2), 0.4)
        if ty == "list":
            for j, it in enumerate(c.get("items", [])):
                put(c["at"][j] if c.get("at") else a + 0.35 + j * 0.3, pop(1300, 600), 0.45)
        if ty == "cta":
            word = c.get("word") or (B.get("cta") or {}).get("word") or "СЛОВО"
            tw = c.get("type_at", a + 0.35)
            for j in range(len(word)):
                put(tw - 0.2 + 0.055 * (j + 1), tick(rng.uniform(0.9, 1.1)), 0.7)
            put(tw + 0.2 + len(word) * 0.055 + 0.3, pop(1400, 500), 0.8)
        if ty == "follow":
            put(c.get("tap", a + 0.45), click(), 0.9)
    if np.abs(S).max() > 0:
        S /= np.abs(S).max() / 0.9
    return S


def voice(path, denoise=False):
    """Processed voice at -17 LUFS mono. Returns (signal, measured LUFS before gain)."""
    tmp = tempfile.mkdtemp()
    den = ",afftdn=nf=-25" if denoise else ""
    chain = (f"highpass=f=70{den},acompressor=threshold=-26dB:ratio=2.5:attack=10:release=150:knee=6:makeup=1,volume=9dB,"
             "acompressor=threshold=-7dB:ratio=8:attack=0.5:release=50:knee=3:makeup=1")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-af", chain, "-ac", "1", "-ar", str(SR), f"{tmp}/vc.wav"], check=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{tmp}/vc.wav", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/vc.wav", "-af", f"volume={-17 - I:.2f}dB,alimiter=limit=0.89:attack=5:release=50:level=disabled",
                    "-ar", str(SR), f"{tmp}/vl.wav"], check=True)
    return read_audio(f"{tmp}/vl.wav", SR).astype(float), I


def speech_rms(v):
    win = int(0.05 * SR)
    e = np.array([np.sqrt(np.mean(v[i:i + win] ** 2)) for i in range(0, len(v) - win, win)])
    return np.sqrt(np.mean(e[e > e.max() * 10 ** (-25 / 20)] ** 2)), e


def music_bed(path, N, v, below_db=18, duck_db=6):
    """Music track looped/cut to N samples, `below_db` quieter than the voice, ducked by `duck_db` while speaking."""
    m = read_audio(path, SR).astype(float)
    if len(m) < N:
        m = np.tile(m, N // max(1, len(m)) + 1)
    m = m[:N]
    vr, e = speech_rms(v)
    mr = np.sqrt(np.mean(m ** 2)) + 1e-9
    m *= vr * 10 ** (-below_db / 20) / mr
    # speaking envelope (50 ms blocks) -> smooth gain, 120 ms attack, 450 ms release
    act = np.repeat((e > vr * 10 ** (-12 / 20)).astype(float), int(0.05 * SR))
    act = np.pad(act, (0, max(0, N - len(act))))[:N]
    g = np.empty(N); cur = 0.0
    a_up, a_dn = 1 - np.exp(-1 / (0.12 * SR)), 1 - np.exp(-1 / (0.45 * SR))
    step = 480  # update every 10 ms, interpolate
    pts = []
    for i in range(0, N, step):
        tgt = act[i]
        cur += (tgt - cur) * (1 - (1 - (a_up if tgt > cur else a_dn)) ** step)
        pts.append(cur)
    g = np.interp(np.arange(N), np.arange(0, N, step), pts)
    m *= 10 ** (-duck_db * g / 20)
    fi, fo = int(0.5 * SR), int(1.5 * SR)
    m[:fi] *= np.linspace(0, 1, fi); m[-fo:] *= np.linspace(1, 0, fo)
    return m


def mixdown(v, N, sfx=None, level="subtle", music=None):
    V = np.zeros(N); V[:min(N, len(v))] = v[:N]
    vr, _ = speech_rms(V[V != 0] if np.any(V) else V)
    out = V.copy()
    if sfx is not None:
        out += sfx * SFX_LEVEL.get(level, 0.05) * (vr / 10 ** (-15 / 20))
    if music is not None:
        out += music
    pk = np.abs(out).max()
    if pk > 10 ** (-1 / 20):
        out *= 10 ** (-1 / 20) / pk
    return out


def write_stereo(path, out):
    import wave
    st = np.stack([out, out], 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
