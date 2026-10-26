#!/usr/bin/env python3
"""Стиль человека живёт на его странице «Монтажный стол» (база страницы), а не в репозитории.
В каждом новом чате его надо скачать со страницы, после любой правки — записать обратно.

    python3 scripts/brand_sync.py pull work/_page        # ArtifactData get brand/current и style/current -> brand/
    python3 scripts/brand_sync.py pull мой_стиль.json    # то же из файла, который человек приложил к чату
    python3 scripts/brand_sync.py push                   # brand/ -> work/_page/brand_current.json -> ArtifactData set brand/current
    python3 scripts/brand_sync.py push --url URL --published   # то же сразу после публикации страницы
    python3 scripts/brand_sync.py pack                   # brand/ -> work/_page/мой_стиль.json (запасной вариант без страницы)
    python3 scripts/brand_sync.py page                   # нужно ли опубликовать страницу заново

Документ brand/current: {"json": <brand.json>, "md": <brand.md>, "savedAt": "..."}.
В brand.json хранится и сама страница: "page": {"url": ..., "ver": ...}.
"""
import sys, json, hashlib, subprocess, datetime, pathlib
from common import ROOT, load_json, save_json

BR = ROOT / "brand"
PAGE = ROOT / "work" / "_page"


def page_ver():
    h = hashlib.sha1()
    for f in ("review/review.html", "engine/reel.js"):
        h.update((ROOT / f).read_bytes())
    return h.hexdigest()[:10]


def local():
    B = load_json(BR / "brand.json", {}) if (BR / "brand.json").exists() else {}
    md = (BR / "brand.md").read_text(encoding="utf-8") if (BR / "brand.md").exists() else ""
    return B, md


def doc(B, md):
    return {"json": B, "md": md, "savedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}


def page_status(B):
    p = B.get("page") or {}
    if not p.get("url"):
        print("страница: адреса нет -> найди её (Artifact list, «Монтажный стол») или опубликуй по docs/review.md")
    elif p.get("ver") != page_ver():
        print(f"страница: {p['url']} УСТАРЕЛА -> опубликуй заново по docs/review.md, затем push --published")
    else:
        print(f"страница: {p['url']} свежая")


args = sys.argv[1:]
cmd = args[0] if args else ""

if cmd == "pull":
    src = pathlib.Path(args[1])
    src = src if src.is_absolute() else ROOT / src
    if src.is_dir():
        D = load_json(src / "brand" / "current.json", None) if (src / "brand" / "current.json").exists() else None
        S = load_json(src / "style" / "current.json", None) if (src / "style" / "current.json").exists() else None
    else:
        D, S = load_json(src), None
    BR.mkdir(exist_ok=True)
    if D and (D.get("json") or D.get("md")):
        save_json(BR / "brand.json", D.get("json") or {})
        (BR / "brand.md").write_text(D.get("md") or "", encoding="utf-8")
        print("стиль со страницы -> brand/brand.json, brand/brand.md")
    else:
        print("на странице ещё нет стиля")
    B, md = local()
    # the person pressed «Сохранить стиль» but the choice has not reached brand/current yet
    if S and S.get("brand") and S.get("savedAt") and S.get("savedAt") != B.get("style_saved_at"):
        print("на странице сохранён новый стиль из примерочной -> применяю")
        subprocess.run([sys.executable, str(ROOT / "scripts" / "style.py"), "import", str(src / "style" / "current.json")], check=True)
        B, md = local()
        print("-> запиши обратно: push, затем ArtifactData set brand/current")
    if not md.strip():
        print("СТИЛЯ НЕТ -> сначала интервью и примерочная (docs/brand-interview.md)")
    page_status(B)

elif cmd == "push":
    B, md = local()
    if "--url" in args:
        B.setdefault("page", {})["url"] = args[args.index("--url") + 1]
    if "--published" in args:
        B.setdefault("page", {})["ver"] = page_ver()
    if B:
        save_json(BR / "brand.json", B)
    PAGE.mkdir(parents=True, exist_ok=True)
    save_json(PAGE / "brand_current.json", doc(B, md))
    print(PAGE / "brand_current.json", "-> ArtifactData set, коллекция brand, документ current, file_path (при замене if_version из последнего get/set)")

elif cmd == "pack":
    B, md = local()
    PAGE.mkdir(parents=True, exist_ok=True)
    out = PAGE / "мой_стиль.json"
    out.write_text(json.dumps(doc(B, md), ensure_ascii=False, indent=1), encoding="utf-8")
    print(out, "-> SendUserFile; попроси прикладывать этот файл к каждому новому чату")

elif cmd == "page":
    page_status(local()[0])
    print("версия файлов страницы:", page_ver())

else:
    raise SystemExit(__doc__)
