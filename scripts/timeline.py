#!/usr/bin/env python3
"""plan.json (что и когда показать, во времени ИСХОДНИКА) + edit.json (как порезали) -> tl.json (готовый таймлайн).

    python3 scripts/timeline.py work/<ролик>

Claude правит только plan.json. Все времена в нём — секунды исходной записи (как в words.json),
поэтому графика не съезжает, когда человек вырезает или возвращает строки: просто запустите скрипт ещё раз.
Если plan.json нет, создаётся пустой. Субтитры собираются из слов автоматически (исправления и выделения — в plan.json).
Формат plan.json — docs/plan.md.
"""
import sys, re
from common import workdir, load_json, save_json, brand, BASE_FIX

d = workdir(sys.argv[1])
E = load_json(d / "edit.json")
B = brand()
P = E["pieces"]
plan_path = d / "plan.json"
if not plan_path.exists():
    save_json(plan_path, {"hook": {"lines": [], "until": None}, "cards": [], "split": [], "shots": [], "taps": [], "hl": [], "steps": [],
                          "zoom": "auto", "fix": {}, "accent": [], "no_accent": []})
PL = load_json(plan_path)
DUR = E["dur"]


def o(t):
    """Source second -> reel second. A moment that was cut out snaps to the next kept moment
    (next in the source, so it also works when cut.json shows parts out of order)."""
    for q in P:
        if q["src0"] <= t <= q["src1"]:
            return round(q["out0"] + (t - q["src0"]) / q["speed"], 3)
    nxt = [q for q in P if q["src0"] > t]
    return min(nxt, key=lambda q: q["src0"])["out0"] if nxt else DUR


def rng(a, b, min_len=0.3):
    x, y = o(a), o(b)
    return [x, max(y, x + min_len)]


# ---------- subtitles ----------
cap = B.get("captions", {})
mode, max_chars = cap.get("mode", "phrase"), cap.get("max_chars", 17)
FIX = dict(BASE_FIX)
FIX.update({k.lower(): v for k, v in B.get("fixes", {}).items()})
DROP = set(x.lower() for x in B.get("drop_words", ["воу", "ву", "эм", "ээ", "э", "мм", "хм"]))
ACC = [x.lower() for x in B.get("accent_words", [])] + ([B["cta"]["word"].lower()] if (B.get("cta") or {}).get("word") else [])
SMALL = {"в", "и", "а", "о", "на", "не", "он", "ты", "же", "об", "с", "по", "вы", "я", "к", "из", "то", "что", "его", "для", "обо", "как",
         "мой", "это", "у", "за", "от", "до", "но", "ни", "бы", "ли", "мы", "да", "так", "вот", "все", "всё", "их", "её", "ей", "им",
         "a", "the", "to", "of", "in", "on", "my", "is", "it", "and", "i", "you"}
fix_idx = {int(k): v for k, v in (PL.get("fix") or {}).items()}
acc_idx, noacc_idx = set(PL.get("accent") or []), set(PL.get("no_accent") or [])

W = sorted(E["words"], key=lambda w: w[1])  # [word, reel t, source t, index]; by reel time (cut.json may reorder parts)
toks, i = [], 0
while i < len(W):
    idx = W[i][3] if len(W[i]) > 3 else i
    if idx in fix_idx:
        if fix_idx[idx].strip():
            toks.append([fix_idx[idx], W[i][1], {idx}])
        i += 1; continue
    for n in (3, 2, 1):
        key = " ".join(w[0].lower() for w in W[i:i + n])
        if len(W[i:i + n]) == n and key in FIX:
            toks.append([FIX[key], W[i][1], {w[3] if len(w) > 3 else 0 for w in W[i:i + n]}]); i += n; break
    else:
        if W[i][0].lower() not in DROP:
            toks.append([W[i][0], W[i][1], {idx}])
        i += 1
subs, i = [], 0
while i < len(toks):
    txt, t0, ids = toks[i][0], toks[i][1], set(toks[i][2])
    j = i + 1
    if tuple(x[0].lower() for x in toks[i:i + 3]) == ("не", "по", "себе"):
        txt = " ".join(x[0] for x in toks[i:i + 3]); j = i + 3
    if mode == "phrase":
        while j < len(toks) and (txt.split()[-1].lower() in SMALL or (toks[j][0].lower() in SMALL and len(toks[j][0]) <= 3)) \
                and toks[j][1] - toks[j - 1][1] < 0.6 and len(txt) + 1 + len(toks[j][0]) <= max_chars:
            txt += " " + toks[j][0]; ids |= toks[j][2]; j += 1
    acc = (any(a in txt.lower() for a in ACC) or bool(re.search(r"[A-Z]{2,}|ChatGPT|Claude", txt)) or bool(ids & acc_idx)) and not (ids & noacc_idx)
    subs.append([round(max(0, t0 - 0.04), 3), None, txt, acc]); i = j
for k in range(len(subs)):
    nxt = subs[k + 1][0] if k + 1 < len(subs) else DUR + 0.05
    subs[k][1] = round(min(nxt, subs[k][0] + (0.9 if mode == "word" else 1.2)), 3)

# ---------- zoom on jump cuts ----------
zoom = []
if PL.get("zoom", "auto") == "auto" and B.get("punch_in", True):
    z, last = False, 0.0
    for k in range(1, len(P)):
        if P[k]["src0"] - P[k - 1]["src1"] > 0.25:
            t = P[k]["out0"]
            if z:
                zoom.append([last, t, 1.07])
            z, last = not z, t
    if z:
        zoom.append([last, DUR + 1, 1.07])
elif isinstance(PL.get("zoom"), list):
    zoom = [[o(a), o(b), *rest] for a, b, *rest in PL["zoom"]]

# ---------- everything else: source time -> reel time ----------
def times(x):
    """Item times inside a card or a motion-panel scene: "at" (one or a list), "tap", any "*_at" (e.g. "show_at")."""
    if isinstance(x, list):
        return [times(v) for v in x]
    if not isinstance(x, dict):
        return x
    out = {}
    for k, v in x.items():
        if k == "src" or k == "alts":
            out[k] = v
        elif k in ("at", "tap") or k.endswith("_at"):
            out[k] = [o(t) if isinstance(t, (int, float)) else t for t in v] if isinstance(v, list) else (o(v) if isinstance(v, (int, float)) else v)
        else:
            out[k] = times(v) if isinstance(v, (dict, list)) else v
    return out


hook = dict(PL.get("hook") or {})
hook["t1"] = o(hook["until"]) if hook.get("until") is not None else 2.5
cards = []
for c in PL.get("cards", []):
    if not c.get("keep") and sum(max(0, min(c["src"][1], q["src1"]) - max(c["src"][0], q["src0"])) for q in P) <= 0.05:
        print(f"! карточка {c.get('id') or c.get('type')} стоит целиком на вырезанных словах и не попадёт в ролик: перенеси её src или убери")
        continue
    c = times(dict(c))
    c["t"] = rng(*c.pop("src"), 0.6)
    cards.append(c)
shots = []
for s in PL.get("shots", []):
    s = dict(s)
    if s.get("rec"):
        m = []
        for st, rt in s["m"]:
            ot = o(st)
            if m and ot <= m[-1][0] + 1e-3:
                m[-1] = [m[-1][0], rt]
            else:
                m.append([ot, rt])
        if len(m) == 1:
            m.append([m[0][0] + 0.04, m[0][1]])
        s["m"] = m
    else:
        s = times(s)
        s["t"] = rng(*s.pop("src"), 0.3)
    shots.append(s)
tl = {"pieces": P, "dur": DUR, "end": round(DUR + 0.6, 2), "src_max": PL.get("src_max"),
      "hook": hook, "subs": subs, "zoom": zoom, "cards": cards,
      "split": [rng(a, b, 1.0) for a, b in PL.get("split", [])], "shots": shots,
      "taps": [[o(t), *r] for t, *r in PL.get("taps", [])],
      "hl": [[*rng(a, b, 0.4), *r] for a, b, *r in PL.get("hl", [])],
      "steps": [[o(t), *r] for t, *r in PL.get("steps", [])],
      "cutout": [[*rng(a, b, 0.3), *r] for a, b, *r in PL.get("cutout", [])],
      "glow": [[*rng(a, b, 0.3), *r] for a, b, *r in PL.get("glow", [])]}
if PL.get("layout"):
    tl["layout"] = PL["layout"]
save_json(d / "tl.json", tl)
print(f"tl.json: {DUR:.1f} с, {len(subs)} субтитров, {len(cards)} карточек, {len(shots)} планов экрана, {len(tl['split'])} сплит")
if "-v" in sys.argv:
    for s in subs:
        print(f"{s[0]:6.2f}-{s[1]:6.2f} {'*' if s[3] else ' '} {s[2]}")
