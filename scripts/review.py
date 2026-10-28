#!/usr/bin/env python3
"""Мост между папкой ролика и страницей «Монтажный стол» (review/review.html).

    python3 scripts/review.py export work/<ролик>             # данные + файлы для страницы -> work/<ролик>/review/
    python3 scripts/review.py fill   work/<ролик> urls.json   # подставить ссылки загруженных файлов -> review/reel_current.json
    python3 scripts/review.py import work/<ролик> review.json # решения человека -> cut.json + plan.json, список правок

export делает:
  proxy.mp4         лёгкая копия исходника 540×960 с уже обработанным голосом (страница проигрывает по ней черновик)
  poster.jpg        первый кадр, пока видео грузится
  thumb_<id>.jpg    настоящий кадр ролика с каждой графикой (рендер шаблона), 540×960: его показывает плеер, когда человек выбирает графику
  rec_<имя>.mp4     лёгкие копии записей экрана (для сплита в живом черновике), img_<файл> — картинки из plan.json
  reel.json         слова с началом и концом, строки, предложенные вырезы, графика, сам plan.json и правила субтитров
                    (по ним страница рисует живой черновик шаблоном); ссылки на файлы пока как "asset:<имя>"
fill заменяет "asset:<имя>" на ссылки из urls.json ({"proxy.mp4": "https://...", ...}).
import печатает строки ИЗМЕНИТЬ / ЗАМЕТКА / КОММЕНТАРИЙ: их надо выполнить до сборки.
"""
import sys, json, glob, re, shutil, subprocess, tempfile, pathlib
import numpy as np
from common import ROOT, workdir, load_json, save_json, read_audio, energy_db, speech_mask, brand, PACING, latin_name_idx, BASE_FIX

cmd, d = sys.argv[1], workdir(sys.argv[2])
R_DIR = d / "review"


def words_with_ends():
    W = load_json(d / "words.json")["words"]
    src = sorted(glob.glob(str(d / "src" / "me.*")))[0]
    a = read_audio(src, 16000)
    sp, _, _ = speech_mask(energy_db(a, 16000))
    T = len(sp) * 0.01
    out = []
    for i, (w, t) in enumerate(W):
        nxt = W[i + 1][1] if i + 1 < len(W) else T
        k, run, end = int((t + min(0.055 * len(w), 0.6)) * 100), 0, None   # skip the word itself, then look for silence
        while k < min(len(sp), int(nxt * 100)):
            run = 0 if sp[k] else run + 1
            if run >= 12:
                end = (k - run + 1) * 0.01 + 0.04; break
            k += 1
        e = min(nxt - 0.02, end if end else nxt - 0.02)
        out.append([w, round(t, 3), round(max(e, min(t + 0.055 * len(w), nxt - 0.02), t + 0.08), 3)])
    return out


def keep_spans_from_cut(W):
    """Source spans kept by cut.json (same reading as cut.py)."""
    C = load_json(d / "cut.json", {})
    if not C.get("keep"):
        return None
    lines = {l["n"]: l for l in load_json(d / "lines.json", [])}
    spans = []
    for e in C["keep"]:
        if isinstance(e, int):
            spans.append([lines[e]["start"], lines[e]["end"]])
        elif isinstance(e, list):
            spans.append(e)
        else:
            l = lines[e["line"]]
            ws = [w for w in W if l["start"] - 0.01 <= w[1] < l["end"]]
            i, j = e.get("from", 0), e.get("to", len(ws))
            spans.append([ws[i][1] - 0.05 if i else l["start"], ws[j][1] - 0.05 if j < len(ws) else l["end"]])
    return spans


def describe(kind, c):
    if kind == "hook":
        return " / ".join(re.sub(r"\*", "", x) for x in c.get("lines", []))
    t = c.get("type")
    if t == "text":
        title = c.get("title", "")
        title = " ".join(title) if isinstance(title, list) else str(title)
        return re.sub(r"\*", "", title).replace("\n", " ") + (f" — {c['sub']}" if c.get("sub") else "")
    if t == "list":
        return f"{c.get('title', '')}: " + ", ".join(re.sub(r"\*", "", x) for x in c.get("items", []))
    if t == "image":
        return ((c.get("label") or "Картинка") + " " + pathlib.Path(c.get("file", "")).name).strip()
    if t == "number":
        return f"{c.get('value')} {c.get('label', '')}"
    if t == "cta":
        return f"Комментарий со словом {c.get('word') or (brand().get('cta') or {}).get('word', '')}"
    if t == "follow":
        return "Кнопка «Подписаться» с нажатием"
    if t == "sticker":
        return f"Стикер {c.get('emoji', '')}"
    if c.get("scene"):
        sc = c["scene"]
        return (re.sub(r"\*", "", sc.get("title", "")) + ": " + ", ".join(PART_NAMES.get(b.get("type"), b.get("type", "")) for b in sc.get("body", []))).strip(": ")
    if t in PART_NAMES:
        txt = c.get("title") or c.get("text") or c.get("q") or c.get("value") or c.get("handle") or ""
        return (PART_NAMES[t] + (": " + re.sub(r"\*", "", str(txt)) if txt else "")).strip()
    return t or kind


PART_NAMES = {"chat": "Чат", "search": "Поиск", "checklist": "Чек-лист", "bars": "Полоски-цели", "funnel": "Воронка", "calendar": "Календарь", "profile": "Профиль",
              "flip": "Перекидные цифры", "polaroids": "Полароиды", "phone": "Телефон", "note": "Заметка от руки", "beforeafter": "До / после", "quote": "Цитата",
              "word": "Слово крупно", "hub": "Схема-связи", "form": "Форма", "site": "Сайт и бренд"}


def asset_walk(o, fn):
    """Every picture path in a card / scene / variant (file, img, files[])."""
    if isinstance(o, list):
        for v in o:
            asset_walk(v, fn)
    elif isinstance(o, dict):
        for k in ("file", "img"):
            if isinstance(o.get(k), str) and re.search(r"\.(png|jpe?g|webp|gif)$", o[k], re.I):
                o[k] = fn(o[k])
        if isinstance(o.get("files"), list):
            o["files"] = [fn(f) for f in o["files"]]
        for k, v in o.items():
            if k != "m" and isinstance(v, (dict, list)):
                asset_walk(v, fn)


if cmd == "export":
    R_DIR.mkdir(exist_ok=True)
    B = brand()
    W = words_with_ends()
    lines_j = load_json(d / "lines.json")
    lines = []
    for l in lines_j:
        idx = [i for i, w in enumerate(W) if l["start"] - 0.01 <= w[1] < l["end"]]
        if idx:
            lines.append([idx[0], idx[-1]])
    spans = keep_spans_from_cut(W)
    cut = [i for i, w in enumerate(W) if spans and not any(a - 0.02 <= w[1] <= b for a, b in spans)]
    pace = dict(PACING[load_json(d / "cut.json", {}).get("pacing") or B.get("pacing") or "tight"])
    speed = load_json(d / "edit.json", {}).get("speed") or pace["speed"]
    PL = load_json(d / "plan.json", {})
    # auto accents: brand words and Latin brand names
    acc_words = [x.lower() for x in B.get("accent_words", [])]
    auto = sorted(set(latin_name_idx(W)) | {i for i, w in enumerate(W) if w[0].lower() in acc_words})
    # board: hook, split ranges, cards — each with an id and a real still
    board, plan_changed = [], False
    if (PL.get("hook") or {}).get("lines"):
        board.append({"id": "hook", "kind": "hook", "what": describe("hook", PL["hook"]), "src": [W[0][1], PL["hook"].get("until") or W[0][1] + 2.5]})
    for k, (a, b) in enumerate(PL.get("split", [])):
        inside = [s for s in PL.get("shots", []) if a - 0.01 <= ((s.get("m") or [[None]])[0][0] if s.get("rec") else (s.get("src") or [0])[0]) <= b]
        n_sc = sum(1 for s in inside if s.get("scene"))
        what = f"Сверху моушн-панели, снизу ты ({n_sc} шт.)" if n_sc and n_sc == len(inside) else f"Сверху запись экрана, снизу ты ({len(inside)} планов)"
        board.append({"id": f"split{k + 1}", "kind": "split", "what": what, "src": [a, b]})
    for n, s in enumerate([s for s in PL.get("shots", []) if s.get("scene")], 1):
        if not s.get("id"):
            s["id"] = f"s{n}"; plan_changed = True
        board.append({"id": s["id"], "kind": "scene", "what": describe("scene", s), "src": s["src"], "vars": 1 + len(s.get("alts", []))})
    for n, c in enumerate(PL.get("cards", []), 1):
        if not c.get("id"):
            c["id"] = f"c{n}"; plan_changed = True
        board.append({"id": c["id"], "kind": c.get("type"), "what": describe("card", c), "src": c["src"], "vars": 1 + len(c.get("alts", []))})
    if plan_changed:
        save_json(d / "plan.json", PL)
    # stills of each graphic (needs tl.json from timeline.py)
    if board and (d / "tl.json").exists():
        subprocess.run([sys.executable, str(ROOT / "scripts" / "timeline.py"), str(d)], check=True, capture_output=True)
        E = load_json(d / "edit.json")

        def o(t):
            for q in E["pieces"]:
                if t < q["src0"]:
                    return q["out0"]
                if t <= q["src1"]:
                    return q["out0"] + (t - q["src0"]) / q["speed"]
            return E["dur"]
        times = []
        for g in board:
            a, b = o(g["src"][0]), o(g["src"][1])
            times.append(round(min(a + 0.9, (a + b) / 2) if g["kind"] != "hook" else 0.6, 2))
        subprocess.run([sys.executable, str(ROOT / "scripts" / "render.py"), "stills", str(d), ",".join(map(str, times))], check=True, capture_output=True)
        from PIL import Image
        for g, t in zip(board, times):
            # 540x960: shown small in the list and full size on the monitor when the graphic is picked
            im = Image.open(d / "st" / f"{t:05.2f}.jpg").resize((540, 960))
            im.save(R_DIR / f"thumb_{g['id']}.jpg", quality=80)
            g["thumb"] = f"asset:thumb_{g['id']}.jpg"
    # proxy with processed voice (the raw phone audio is much quieter and sounds broken next to it)
    src = sorted(glob.glob(str(d / "src" / "me.*")))[0]
    tmp = tempfile.mkdtemp()
    chain = ("highpass=f=70,acompressor=threshold=-26dB:ratio=2.5:attack=10:release=150:knee=6:makeup=1,volume=9dB,"
             "acompressor=threshold=-7dB:ratio=8:attack=0.5:release=50:knee=3:makeup=1,alimiter=limit=0.89:level=disabled")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=540:960:force_original_aspect_ratio=increase,crop=540:960",
                    "-af", chain, "-c:v", "libx264", "-preset", "veryfast", "-b:v", "900k", "-maxrate", "1200k", "-bufsize", "2M",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ac", "1", "-movflags", "+faststart", str(R_DIR / "proxy.mp4")], check=True)
    from PIL import Image
    first = sorted((d / "mf").glob("*.jpg"))
    if first:
        Image.open(first[min(len(first) - 1, 15)]).resize((540, 960)).save(R_DIR / "poster.jpg", quality=80)
    src_dur = len(read_audio(src, 16000)) / 16000
    plan_fix = {str(k): v for k, v in (PL.get("fix") or {}).items()}
    # live draft on the page: the plan itself (source seconds), subtitle rules and light copies of screen recordings
    live_files = []
    LP = json.loads(json.dumps(PL))

    def to_asset(f):
        if not (d / f).exists():
            return f
        name = "img_" + pathlib.Path(f).name
        shutil.copy(d / f, R_DIR / name)
        if name not in live_files:
            live_files.append(name)
        return "asset:" + name
    asset_walk(LP.get("cards", []) + LP.get("shots", []), to_asset)
    FIXW = dict(BASE_FIX)
    FIXW.update({k.lower(): v for k, v in B.get("fixes", {}).items()})
    sub = {"fix": FIXW, "drop": B.get("drop_words", ["воу", "ву", "эм", "ээ", "э", "мм", "хм"]),
           "acc": [x.lower() for x in B.get("accent_words", [])] + ([B["cta"]["word"].lower()] if (B.get("cta") or {}).get("word") else [])}
    FR = load_json(d / "frames.json", {"rec": {}})
    recs = {}
    for name, info in (FR.get("rec") or {}).items():
        if not any(s.get("rec") == name for s in PL.get("shots", [])):
            continue
        out = R_DIR / f"rec_{name}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", info["file"], "-an", "-vf", "scale=trunc(iw/4)*2:-2,fps=30",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-g", "10", "-keyint_min", "10",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], check=True)
        recs[name] = {"src": f"asset:rec_{name}.mp4", "w": info["w"], "h": info["h"], "n": info["n"], "fps": info.get("fps", 30)}
        live_files.append(out.name)
    reel = {"id": d.name, "title": PL.get("title") or d.name, "src": "asset:proxy.mp4", "poster": "asset:poster.jpg" if (R_DIR / "poster.jpg").exists() else "", "srcDur": round(src_dur, 2), "speed": speed,
            "maxPause": pace["max_pause"], "keepPause": pace["keep_pause"], "words": W, "lines": lines, "cut": cut,
            "acc": PL.get("accent", []), "autoAcc": auto, "fix": plan_fix, "cards": board,
            "plan": LP, "sub": sub, "recs": recs, "brand": B}
    save_json(R_DIR / "reel.json", reel)
    files = ["proxy.mp4"] + (["poster.jpg"] if (R_DIR / "poster.jpg").exists() else []) + [f"thumb_{g['id']}.jpg" for g in board if g.get("thumb")] + live_files
    print(f"{len(W)} слов, {len(lines)} строк, предложено вырезать {len(cut)} слов, графики: {len(board)}")
    print("загрузить на страницу (Artifact, asset: true, file_paths):")
    for f in files:
        print("  ", R_DIR / f)
    for f in ["proxy.mp4"] + [x for x in live_files if x.endswith(".mp4")]:
        print(f"{f}: {(R_DIR / f).stat().st_size / 1e6:.1f} МБ")

elif cmd == "fill":
    urls = load_json(sys.argv[3])
    txt = (R_DIR / "reel.json").read_text(encoding="utf-8")
    for name, u in urls.items():
        txt = txt.replace(f'"asset:{name}"', json.dumps(u))
    left = re.findall(r'"asset:([^"]+)"', txt)
    if left:
        raise SystemExit("нет ссылок для: " + ", ".join(left))
    (R_DIR / "reel_current.json").write_text(txt, encoding="utf-8")
    print(R_DIR / "reel_current.json", "-> ArtifactData set reel/current (file_path)")

elif cmd == "import":
    Rv = load_json(sys.argv[3])
    reel = load_json(R_DIR / "reel.json")
    if Rv.get("reel") and Rv["reel"] != reel["id"]:
        raise SystemExit(f"решения относятся к другому ролику: {Rv['reel']}")
    W = reel["words"]
    cut = set(Rv.get("cut", reel["cut"]))
    keep, run = [], []
    for i in range(len(W)):
        if i in cut:
            if run:
                keep.append(run); run = []
        else:
            run.append(i)
    if run:
        keep.append(run)
    spans = [[round(max(0, W[r[0]][1] - 0.06), 3), round(W[r[-1]][2] + 0.06, 3)] for r in keep]
    C = load_json(d / "cut.json", {})
    shutil.copy(d / "plan.json", d / "plan.json.bak") if (d / "plan.json").exists() else None
    C["keep"] = spans
    save_json(d / "cut.json", C)
    PL = load_json(d / "plan.json", {})
    PL["fix"] = {str(k): v for k, v in (Rv.get("fix") or {}).items()}
    PL["accent"] = sorted(set(Rv.get("acc", [])))
    PL["no_accent"] = sorted(set(Rv.get("noacc", [])))
    names = {g["id"]: g for g in reel["cards"]}
    todo, likes = [], []
    items = {x["id"]: x for x in PL.get("cards", []) + PL.get("shots", []) if x.get("id")}
    for a in Rv.get("adds") or []:      # graphics the person added on the page: a first version, Claude finishes it
        a = dict(a)
        PL.setdefault("cards", []).append(a)
        items[a["id"]] = a
        names[a["id"]] = {"what": PART_NAMES.get(a.get("type"), a.get("type")), "kind": a.get("type")}
        todo.append(f"ДОБАВЛЕНО {a['id']} ({PART_NAMES.get(a.get('type'), a.get('type'))}) на {a['src'][0]:.2f} с исходника: проверь текст и тайминг, сделай как следует")
    for gid, st in (Rv.get("board") or {}).items():
        g = names.get(gid)
        it = items.get(gid)
        if it is not None and st.get("pick") and it.get("alts") and st["pick"] <= len(it["alts"]):
            alt = it["alts"][st["pick"] - 1]
            keep = {k: it[k] for k in ("id", "src", "keep", "x", "y", "in_split") if k in it}
            rest = [x for i, x in enumerate([dict(it, alts=None)] + it["alts"]) if i != st["pick"]]
            it.clear(); it.update(keep); it.update(alt)
            it["alts"] = [{k: v for k, v in x.items() if k not in ("id", "src", "keep", "alts")} for x in rest]
            print(f"ВЫБРАН ВАРИАНТ {gid}: {alt.get('label') or alt.get('type') or 'панель'}")
        if it is not None and st.get("y") is not None:
            it["y"] = st["y"]
        if st.get("more"):
            todo.append(f"ЕЩЁ ВАРИАНТЫ {gid} ({(g or {}).get('what', '')}): добавь 2–3 новых alts в духе выбранного")
        if st.get("like") and it is not None:
            likes.append(it.get("label") or it.get("type") or "панель")
        if not g:
            continue
        if st.get("state") == "d":
            if gid == "hook":
                PL.setdefault("hook", {})["lines"] = []
            elif gid.startswith("split"):
                k = int(gid[5:]) - 1
                if k < len(PL.get("split", [])):
                    PL["split"][k] = None
            else:
                PL["cards"] = [c for c in PL.get("cards", []) if c.get("id") != gid]
                PL["shots"] = [s for s in PL.get("shots", []) if s.get("id") != gid]
            print(f"УБРАНО: {gid} ({g['what']})")
        elif st.get("state") == "c":
            todo.append(f"ИЗМЕНИТЬ {gid} ({g['what']}): {st.get('note') or '(без комментария, спроси что поменять)'}")
    if PL.get("split"):
        PL["split"] = [s for s in PL["split"] if s]
    save_json(d / "plan.json", PL)
    print(f"cut.json: {len(spans)} кусков, вырезано слов: {len(cut)}; исправлений: {len(PL['fix'])}; выделений: {len(PL['accent'])}")
    for t in todo:
        print(t)
    if likes:
        print("В СТИЛЬ: " + ", ".join(likes) + " — допиши в brand.md «Любимая графика» и в brand.json gfx_like, потом brand_sync push")
    for n in sorted(Rv.get("notes", []), key=lambda n: n["t"]):
        where = "превью" if n.get("on") == "preview" else "черновик"
        print(f"ЗАМЕТКА {int(n['t'] // 60)}:{n['t'] % 60:04.1f} ({where}): {n['text']}")
    if (Rv.get("general") or "").strip():
        print("КОММЕНТАРИЙ:", Rv["general"].strip())
    print("дальше: cut.py -> timeline.py -> render.py video --preview")
else:
    raise SystemExit(__doc__)
