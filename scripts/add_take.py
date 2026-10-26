#!/usr/bin/env python3
"""Человек дозаписал кусок (забыл пункт, переговорил фразу): вклеить его в исходник ролика.

    python3 scripts/add_take.py work/<ролик> <новое видео> --after-line N [--en]
    python3 scripts/add_take.py work/<ролик> <новое видео>            # в конец исходника

--after-line N вклеивает дубль в паузу после строки N (номер из lines.json). Так куски идут по порядку,
и «Монтажный стол» показывает ролик правильно: страница не умеет переставлять куски местами.

Что делает:
- первый раз переименовывает src/me.* в src/me_take1.*, дубль кладёт как src/me_take2.mov (потом take3…);
  порядок кусков хранится в src/takes.json, из них собирается src/me.mov (1080×1920, 30 кадров/с, звук без потерь);
- распознаёт только дубль и вставляет его слова на место. Слова и времена после вставки сдвигаются;
- сам переносит plan.json (все секунды исходника и номера слов в fix / accent / no_accent) и cut.json
  (строки после вставки получают новые номера, строки дубля встают в keep сразу после строки N);
- пересобирает lines.json.

Дальше: cut.py, timeline.py, frames.py как обычно. Если в сплите стоит моушн-панель, пересчитай её карту
(split_map) по новым секундам из plan.json.
"""
import sys, glob, json, pathlib, shutil, subprocess
from common import workdir, load_json, save_json

argv = sys.argv[1:]
EN = "--en" in argv
after = None
if "--after-line" in argv:
    k = argv.index("--after-line"); after = int(argv[k + 1]); del argv[k:k + 2]
args = [a for a in argv if not a.startswith("--")]
if len(args) < 2:
    raise SystemExit(__doc__)
d = workdir(args[0]); new = pathlib.Path(args[1])
src = d / "src"
here = pathlib.Path(__file__).resolve().parent
FPS = 30


def vdur(f):
    """Video length snapped to whole frames: the glue is cut on frame boundaries so lips stay in sync."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames,duration",
                        "-of", "json", str(f)], capture_output=True, text=True)
    s = json.loads(r.stdout)["streams"][0]
    n = int(s.get("nb_frames") or 0) or round(float(s["duration"]) * FPS)
    return round(n / FPS, 4)


# ---------- segments: which piece of which take goes where ----------
TJ = src / "takes.json"
if TJ.exists():
    segs = load_json(TJ)["segments"]
    for old in src.glob("me.*"):
        old.unlink()
else:
    takes = sorted(src.glob("me_take*.*"), key=lambda p: int(p.stem[7:]))
    if takes:  # older layout: takes glued one after another
        segs = [[t.name, 0, vdur(t)] for t in takes]
        for old in src.glob("me.*"):
            old.unlink()
    else:
        me = sorted(glob.glob(str(src / "me.*")))
        if not me:
            raise SystemExit("нет src/me.*")
        first = pathlib.Path(me[0]); t1 = src / ("me_take1" + first.suffix)
        first.rename(t1)
        segs = [[t1.name, 0, vdur(t1)]]
n = 1 + max(int(pathlib.Path(s[0]).stem[7:]) for s in segs)
nt = src / f"me_take{n}{new.suffix or '.mov'}"
shutil.copy(new, nt)
D = vdur(nt)
total = round(sum(b - a for _, a, b in segs), 4)

W0 = load_json(d / "words.json")["words"]
L0 = load_json(d / "lines.json", [])
if after is not None and any(l["n"] == after + 1 for l in L0):
    la = next(l for l in L0 if l["n"] == after); lb = next(l for l in L0 if l["n"] == after + 1)
    T = round(round((la["end"] + lb["start"]) / 2 * FPS) / FPS, 4)
else:
    T = total
    if after is not None:
        print(f"строка {after} последняя: дубль идёт в конец")

# split the segment that contains T and put the take there
out, s0, done = [], 0.0, False
for f, a, b in segs:
    ln = b - a
    if not done and s0 <= T < s0 + ln - 1e-6:
        cut = round(a + (T - s0), 4)
        if cut > a + 1e-6:
            out.append([f, a, cut])
        out.append([nt.name, 0, D]); out.append([f, cut, b]); done = True
    else:
        out.append([f, a, b])
    s0 += ln
if not done:
    out.append([nt.name, 0, D])
segs = out
save_json(TJ, {"segments": segs})

# ---------- glue src/me.mov ----------
inputs, chain = [], ""
for i, (f, a, b) in enumerate(segs):
    inputs += ["-i", str(src / f)]
    ln = round(b - a, 4)
    chain += (f"[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps={FPS},"
              f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v{i}];"
              f"[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=0:{ln}[a{i}];")
chain += "".join(f"[v{i}][a{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=1[v][a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", chain, "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p",
                "-c:a", "pcm_s16le", str(src / "me.mov")], check=True)

# ---------- words: take in its place, the rest shifted ----------
tmp = d / f"words_take{n}.json"
subprocess.run([sys.executable, str(here / "transcribe.py"), str(nt), str(tmp)] + (["--en"] if EN else []), check=True)
TW = load_json(tmp)["words"]
ft = lambda t: t if t < T else round(t + D, 3)          # old source second -> new
before = [i for i, w in enumerate(W0) if w[1] < T]
after_i = [i for i, w in enumerate(W0) if w[1] >= T]
W = [W0[i] for i in before] + [[w, round(s + T, 3)] for w, s in TW] + [[W0[i][0], ft(W0[i][1])] for i in after_i]
imap = {i: i for i in before}
imap.update({i: len(before) + len(TW) + k for k, i in enumerate(after_i)})
take_idx = set(range(len(before), len(before) + len(TW)))
save_json(d / "words.json", {"text": " ".join(w[0] for w in W), "words": W})
subprocess.run([sys.executable, str(here / "lines.py"), str(d)], check=True, capture_output=True)
L = load_json(d / "lines.json", [])


def line_words(lines, words, l):
    return [i for i, w in enumerate(words) if l["start"] - 0.01 <= w[1] < l["end"]]


# ---------- plan.json: source seconds and word numbers ----------
PL = load_json(d / "plan.json", None)
if PL:
    def tt(x): return ft(x) if isinstance(x, (int, float)) else x
    if (PL.get("hook") or {}).get("until") is not None:
        PL["hook"]["until"] = tt(PL["hook"]["until"])
    for c in PL.get("cards", []):
        for k in ("src",):
            if k in c: c[k] = [tt(x) for x in c[k]]
        for k in ("type_at", "tap"):
            if k in c: c[k] = tt(c[k])
        if "at" in c: c["at"] = [tt(x) for x in c["at"]]
    PL["split"] = [[tt(a), tt(b)] for a, b in PL.get("split", [])]
    for s in PL.get("shots", []):
        if "src" in s: s["src"] = [tt(x) for x in s["src"]]
        if "m" in s: s["m"] = [[tt(a), r] for a, r in s["m"]]
    for k in ("taps", "steps"):
        PL[k] = [[tt(x[0]), *x[1:]] for x in PL.get(k, [])]
    PL["hl"] = [[tt(x[0]), tt(x[1]), *x[2:]] for x in PL.get("hl", [])]
    if isinstance(PL.get("zoom"), list):
        PL["zoom"] = [[tt(x[0]), tt(x[1]), *x[2:]] for x in PL["zoom"]]
    if PL.get("src_max") is not None:
        PL["src_max"] = tt(PL["src_max"])
    if PL.get("fix"):
        PL["fix"] = {str(imap.get(int(k), int(k))): v for k, v in PL["fix"].items()}
    for k in ("accent", "no_accent"):
        if PL.get(k):
            PL[k] = sorted(imap.get(i, i) for i in PL[k])
    save_json(d / "plan.json", PL)

# ---------- cut.json: renumber lines, put the take after line N ----------
C = load_json(d / "cut.json", None)
new_lines = [l["n"] for l in L if set(line_words(L, W, l)) & take_idx]
if C and C.get("keep"):
    old_lines = {l["n"]: l for l in L0}
    by_words = {tuple(line_words(L, W, l)): l["n"] for l in L}
    keep, pos = [], None
    for e in C["keep"]:
        if isinstance(e, list):
            keep.append([ft(e[0]), ft(e[1])]); t0 = e[0]
        else:
            ln = e if isinstance(e, int) else e["line"]
            ow = line_words(L0, W0, old_lines[ln]); t0 = old_lines[ln]["start"]
            nl = by_words.get(tuple(imap[i] for i in ow))
            if nl is not None:
                keep.append(nl if isinstance(e, int) else {**e, "line": nl})
            else:  # line boundaries moved: keep the same words as a span of seconds
                sel = ow if isinstance(e, int) else ow[e.get("from", 0):e.get("to", len(ow))]
                a = W[imap[sel[0]]][1] - 0.05; b = W[imap[sel[-1]]][1] + 0.6
                keep.append([round(a, 3), round(b, 3)])
        if after is not None and pos is None and t0 >= T:
            pos = len(keep) - 1
    if after is not None:
        if pos is None:
            pos = len(keep)
        keep[pos:pos] = new_lines
    C["keep"] = keep
    if C.get("cuts"):
        C["cuts"] = [[ft(a), ft(b)] for a, b in C["cuts"]]
    save_json(d / "cut.json", C)

print(f"дубль {n}: {D} с, вклеен на {T} с исходника; новые строки {new_lines}")
print("plan.json и cut.json перенесены" if after is not None else "дубль в конце: поставь его строки в cut.json сам")
print("дальше: cut.py, timeline.py, frames.py")
