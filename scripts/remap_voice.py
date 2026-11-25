"""Перенос плана ролика на новую запись того же текста (другой голос, закадр, переозвучка).

    python3 scripts/remap_voice.py work/СТАРЫЙ work/НОВЫЙ

Сопоставляет слова старой и новой расшифровки (words.json), строит соответствие
«секунда старого исходника → секунда нового» по совпавшим словам и переносит все
времена plan.json: src, split, until, at, tap, *_at, cursor/cam, а также номера слов
в fix / accent / no_accent. Результат — НОВЫЙ/plan.json (старый не трогается).
Слова, которых нет в новой записи, остаются без пары: их времена ложатся между соседями.
"""
import sys, json, re, difflib, pathlib
import numpy as np

old_d, new_d = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
ow = json.load(open(old_d / "words.json"))["words"]
nw = json.load(open(new_d / "words.json"))["words"]


def norm(s):
    s = s.lower().replace("ё", "е")
    return re.sub(r"[^a-zа-я0-9]", "", s)


A = [norm(w[0]) for w in ow]
Bn = [norm(w[0]) for w in nw]
sm = difflib.SequenceMatcher(None, A, Bn, autojunk=False)
pairs = []
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        pairs.append((a + k, b + k))
# неточные совпадения внутри заменённых кусков: похожие слова на равных местах
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "replace":
        for k in range(min(i2 - i1, j2 - j1)):
            if difflib.SequenceMatcher(None, A[i1 + k], Bn[j1 + k]).ratio() >= 0.6:
                pairs.append((i1 + k, j1 + k))
pairs.sort()
IDX = dict(pairs)
ot = np.array([ow[i][1] for i, _ in pairs]); nt = np.array([nw[j][1] for _, j in pairs])
keep = np.concatenate([[True], np.diff(ot) > 0]); ot, nt = ot[keep], nt[keep]
OLD_END = ow[-1][1] + 1.0; NEW_END = nw[-1][1] + 1.0


def T(t):
    if t <= ot[0]:
        return round(max(0.0, nt[0] - (ot[0] - t)), 3)
    if t >= ot[-1]:
        return round(min(NEW_END + 2, nt[-1] + (t - ot[-1])), 3)
    return round(float(np.interp(t, ot, nt)), 3)


def walk(x, key=None):
    if isinstance(x, list):
        if key == "src" and len(x) == 2 and all(isinstance(v, (int, float)) for v in x):
            return [T(x[0]), T(x[1])]
        if key == "split":
            return [[T(a), T(b)] + list(r) for a, b, *r in x]
        if key in ("cursor", "cam"):
            return [[T(e[0])] + list(e[1:]) if isinstance(e, list) and e and isinstance(e[0], (int, float)) else e for e in x]
        if key in ("at", "tap") or (key or "").endswith("_at"):
            return [T(v) if isinstance(v, (int, float)) else v for v in x]
        return [walk(v) for v in x]
    if isinstance(x, dict):
        return {k: walk(v, k) for k, v in x.items()}
    if isinstance(x, (int, float)) and not isinstance(x, bool) and (key in ("at", "tap", "until") or (key or "").endswith("_at")):
        return T(x)
    return x


P = json.load(open(old_d / "plan.json"))
fix, acc, nacc = P.pop("fix", {}), P.pop("accent", []), P.pop("no_accent", [])
Q = walk(P)
Q["fix"] = {str(IDX[int(k)]): v for k, v in fix.items() if int(k) in IDX}
Q["accent"] = sorted(IDX[i] for i in acc if i in IDX)
Q["no_accent"] = sorted(IDX[i] for i in nacc if i in IDX)
json.dump(Q, open(new_d / "plan.json", "w"), ensure_ascii=False, indent=1)
miss = [ow[i][0] for i in range(len(ow)) if i not in IDX]
print(f"пар слов: {len(pairs)} из {len(ow)} старых / {len(nw)} новых; без пары: {' '.join(miss[:40])}")
