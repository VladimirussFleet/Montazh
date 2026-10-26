#!/usr/bin/env python3
"""Примерочная стиля: образцы для вкладки «Стиль» на странице и сохранение выбора в brand/.

    python3 scripts/style.py export work/<ролик>              # кадры и звуковые образцы -> work/<ролик>/style/
    python3 scripts/style.py fill   work/<ролик> urls.json    # подставить ссылки загруженных файлов -> style/samples_current.json
    python3 scripts/style.py import style.json                # выбор человека -> brand/brand.json и brand/brand.md

export делает:
  f1.jpg f2.jpg f3.jpg           три кадра человека (на них примеряются хук, субтитры, карточки)
  tempo_natural/tight/fast.mp4   7 секунд его голоса в трёх темпах
  samples.json                   всё вместе + его хук и фразы для примерки; ссылки пока "asset:<имя>"
"""
import sys, json, re, glob, subprocess, tempfile
import numpy as np
from common import ROOT, workdir, load_json, save_json, read_audio, write_wav, brand, BASE_FIX, latin_name_idx
from audio import SR, voice

cmd = sys.argv[1]


def merge(a, b):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return b
    o = dict(a)
    for k, v in b.items():
        o[k] = merge(a.get(k), v) if k in a else v
    return o


def m4a(x, path):
    tmp = tempfile.mktemp(suffix=".wav")
    write_wav(tmp, x, SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(path)], check=True)


if cmd == "export":
    d = workdir(sys.argv[2])
    out = d / "style"; out.mkdir(exist_ok=True)
    src = sorted(glob.glob(str(d / "src" / "me.*")))[0]
    FR = load_json(d / "frames.json")
    n = FR["me"]["n"]
    from PIL import Image
    for i, f in enumerate((0.15, 0.45, 0.75), 1):
        Image.open(d / "mf" / f"{max(1, int(n * f)):04d}.jpg").resize((540, 960)).save(out / f"f{i}.jpg", quality=82)
    # 7.5 s of real speech, starting at a line start in the first third
    W = load_json(d / "words.json")["words"]
    lines = load_json(d / "lines.json", [])
    a = next((l["start"] for l in lines if l["start"] > 1.0), W[0][1] if W else 0.0)
    v, _ = voice(src)
    seg = v[int(a * SR): int((a + 7.5) * SR)]
    tmp = tempfile.mkdtemp()
    write_wav(f"{tmp}/seg.wav", seg, SR)
    tempo = {}
    for name, sp in (("natural", 1.0), ("tight", 1.08), ("fast", 1.12)):
        if sp == 1.0:
            y = seg
        else:
            subprocess.run(["rubberband", "-3", "--formant", "-q", "-T", str(sp), f"{tmp}/seg.wav", f"{tmp}/{name}.wav"], check=True, capture_output=True)
            y = read_audio(f"{tmp}/{name}.wav", SR).astype(float)
        f = int(0.15 * SR); y = y.copy(); y[-f:] *= np.linspace(1, 0, f)
        m4a(y, out / f"tempo_{name}.mp4"); tempo[name] = f"asset:tempo_{name}.mp4"
    # his own words for the preview
    PL = load_json(d / "plan.json", {})
    toks, i = [], 0
    low = [w[0].lower() for w in W]
    acc = set(latin_name_idx(W))
    while i < len(W) and len(toks) < 16:
        for k in (3, 2, 1):
            key = " ".join(low[i:i + k])
            if key in BASE_FIX:
                toks.append([BASE_FIX[key], i in acc]); i += k; break
        else:
            if low[i] not in ("воу", "ву", "эм", "ээ"):
                toks.append([W[i][0], i in acc])
            i += 1
    phrases, cur = [], []
    for t, a_ in toks:
        cur.append((t, a_))
        if len(" ".join(x for x, _ in cur)) >= 9 or len(cur) == 3:
            phrases.append([" ".join(x for x, _ in cur), any(y for _, y in cur)]); cur = []
    if cur:
        phrases.append([" ".join(x for x, _ in cur), any(y for _, y in cur)])
    hook = (PL.get("hook") or {}).get("lines") or []
    if not hook:
        hw = [t for t, _ in toks[:6]]
        hook = [" ".join(hw[:3]).upper(), " ".join(hw[3:6]).upper()]
    B = brand()
    if not B.get("cards"):
        print("! в brand.json нет cards.top: посмотри кадры (peek.py me) и задай высоту карточек под подбородком, иначе в примерочной будет 1100")
    samples = {"id": d.name, "frames": [f"asset:f{i}.jpg" for i in (1, 2, 3)], "tempo": tempo,
               "hook": hook, "phrases": phrases[:8], "brand": B}
    save_json(out / "samples.json", samples)
    files = [f"f{i}.jpg" for i in (1, 2, 3)] + [f"tempo_{k}.mp4" for k in tempo]
    print("загрузить на страницу (Artifact, asset: true, file_paths):")
    for f in files:
        print("  ", out / f)

elif cmd == "fill":
    d = workdir(sys.argv[2])
    urls = load_json(sys.argv[3])
    txt = (d / "style" / "samples.json").read_text(encoding="utf-8")
    for name, u in urls.items():
        txt = txt.replace(f'"asset:{name}"', json.dumps(u))
    left = re.findall(r'"asset:([^"]+)"', txt)
    if left:
        raise SystemExit("нет ссылок для: " + ", ".join(left))
    (d / "style" / "samples_current.json").write_text(txt, encoding="utf-8")
    print(d / "style" / "samples_current.json", "-> ArtifactData set style/samples (file_path)")

elif cmd == "import":
    S = load_json(sys.argv[2])
    chosen = S.get("brand") or {}
    path = ROOT / "brand" / "brand.json"
    B = merge(load_json(path, {}), chosen)
    if S.get("savedAt"):
        B["style_saved_at"] = S["savedAt"]
    path.parent.mkdir(exist_ok=True)
    save_json(path, B)
    F = {"montserrat": "Montserrat", "unbounded": "Unbounded", "onest": "Onest", "golos-text": "Golos Text", "rubik": "Rubik", "manrope": "Manrope",
         "inter": "Inter", "playfair-display": "Playfair Display", "jetbrains-mono": "JetBrains Mono", "nunito": "Nunito", "comfortaa": "Comfortaa",
         "oswald": "Oswald", "dela-gothic-one": "Dela Gothic One", "russo-one": "Russo One", "caveat": "Caveat", "shantell-sans": "Shantell Sans",
         "pangolin": "Pangolin", "neucha": "Neucha", "playpen-sans": "Playpen Sans", "amatic-sc": "Amatic SC", "pacifico": "Pacifico", "lobster": "Lobster",
         "marck-script": "Marck Script", "bad-script": "Bad Script", "great-vibes": "Great Vibes", "comforter-brush": "Comforter Brush",
         "yeseva-one": "Yeseva One", "prata": "Prata", "cormorant-garamond": "Cormorant Garamond", "kurale": "Kurale"}
    c, cap, hk = B.get("colors", {}), B.get("captions", {}), B.get("hook", {})
    fo = B.get("fonts") or {}
    mus = B.get("music") or {}
    section = "\n".join([
        "## Стиль (выбран в примерочной)",
        f"- Образ: {S.get('preset') or 'свой'}",
        f"- Шрифты: хук {F.get(fo.get('head'), '?')}, субтитры {F.get(fo.get('captions') or fo.get('head'), '?')}, "
        f"карточки {F.get(fo.get('cards') or fo.get('head'), '?')}, мелкий текст {F.get(fo.get('body'), '?')}",
        f"- Цвета: выделение в субтитрах {c.get('accent')}, в хуке {c.get('hook_accent') or c.get('accent')}, в карточках {c.get('card_accent')}, "
        f"рамки и шаги {c.get('ui')}, карточки {'тёмные' if c.get('card', '#FFFFFF').upper() != '#FFFFFF' else 'светлые'}",
        f"- Субтитры: {'по одному слову' if cap.get('mode') == 'word' else 'фразами'}, "
        f"{ {'upper': 'капсом', 'lower': 'строчными'}.get(cap.get('case'), 'как сказано') }, "
        f"{ {'box': 'на плашке', 'outline': 'с обводкой'}.get(cap.get('style'), 'с тенью') }, размер {cap.get('size')}, высота {cap.get('y')}",
        f"- Хук: {'текст с тенью' if hk.get('style') == 'text' else 'плашка ' + str(c.get('plate'))}",
        f"- Темп: { {'natural': 'естественный', 'tight': 'плотный', 'fast': 'быстрый'}.get(B.get('pacing'), B.get('pacing')) }, звуки: { {'none': 'без звуков', 'subtle': 'тихие', 'lots': 'побольше'}.get(B.get('sfx'), B.get('sfx')) }",
        f"- Музыка: {'свой трек под голосом, на ' + str(mus.get('below_db', 18)) + ' dB тише голоса' if mus.get('enabled') else 'нет (трек добавляется в Instagram)'}",
        ""])
    md = ROOT / "brand" / "brand.md"
    text = md.read_text(encoding="utf-8") if md.exists() else f"# Стиль рилсов: {B.get('name', '')}\n\n## Правила\n"
    text = re.sub(r"## Стиль \(выбран в примерочной\)\n(?:- .*\n)*\n?", "", text)
    # older hand-written style sections are replaced by the fitting-room choice
    for h in ("Шрифт и цвета", "Субтитры", "Хук", "Темп и графика"):
        text = re.sub(rf"## {h}\n(?:(?!## ).*\n?)*", "", text)
    if "## Правила" in text:
        text = text.replace("## Правила", section + "\n## Правила", 1)
    else:
        text = text.rstrip() + "\n\n" + section
    md.write_text(text, encoding="utf-8")
    print(section)
    print("сохранено в brand/brand.json и brand/brand.md -> brand_sync.py push, затем ArtifactData set brand/current")
else:
    raise SystemExit(__doc__)
