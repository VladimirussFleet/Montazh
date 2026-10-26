#!/usr/bin/env python3
"""Рендер ролика по шаблону engine/reel.html.

    python3 scripts/render.py stills work/<ролик> 0.5,3.2,10      # отдельные кадры -> st/*.jpg
    python3 scripts/render.py sheet  work/<ролик> [шаг=1]         # лист кадров каждые N секунд -> sheet.jpg
    python3 scripts/render.py video  work/<ролик> [--preview]     # звук + видео -> final.mp4 (или preview.mp4)

video: сначала mix.py (голос + звуки), потом кадры через Chromium, потом сжатие под Instagram
(два прохода, 1080×1920, обычно меньше 30 МБ). --preview: 15 кадров/с, 540×960, в 2 раза быстрее.
"""
import sys, os, json, base64, subprocess, threading, http.server, functools, socket, time, pathlib, math
from common import ROOT, workdir, rel, load_json, brand

mode, d = sys.argv[1], workdir(sys.argv[2])
args = sys.argv[3:]
TL, FR, B = load_json(d / "tl.json"), load_json(d / "frames.json"), brand()


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


sock = socket.socket(); sock.bind(("127.0.0.1", 0)); PORT = sock.getsockname()[1]; sock.close()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()


def page(pw):
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    logs = []
    pg.on("pageerror", lambda e: logs.append("ERR " + str(e)))
    pg.on("console", lambda m: logs.append(m.text))
    pg.goto(f"http://127.0.0.1:{PORT}/engine/reel.html")
    r = pg.evaluate("c=>init(c)", {"tl": TL, "frames": FR, "brand": B, "dir": rel(d)})
    if r != "ok":
        raise SystemExit("шаблон не запустился: " + str(r) + "\n" + "\n".join(logs))
    return b, pg, logs


def grab(pg, q=0.93):
    return base64.b64decode(pg.evaluate(f"document.getElementById('c').toDataURL('image/jpeg',{q})").split(",", 1)[1])


def show_logs(logs):
    bad = [l for l in logs if l.startswith("ERR") or l.startswith("WARN")]
    if bad:
        print("\n".join(dict.fromkeys(bad)))
    (d / "render.log").write_text("\n".join(logs), encoding="utf-8")


from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    if mode == "stills":
        b, pg, logs = page(pw)
        (d / "st").mkdir(exist_ok=True)
        for t in [float(x) for x in args[0].split(",")]:
            pg.evaluate("async t=>{await frame(t)}", t)
            p = d / "st" / f"{t:05.2f}.jpg"; p.write_bytes(grab(pg)); print(p)
        show_logs(logs); b.close()

    elif mode == "sheet":
        from PIL import Image, ImageDraw
        import io
        step = float(args[0]) if args else 1.0
        b, pg, logs = page(pw)
        ts = [round(i * step + 0.3, 2) for i in range(int(TL["end"] / step))]
        cols, tw = 8, 216
        th = tw * 16 // 9
        sheet = Image.new("RGB", (cols * tw, math.ceil(len(ts) / cols) * (th + 22)), "#222")
        dr = ImageDraw.Draw(sheet)
        for i, t in enumerate(ts):
            pg.evaluate("async t=>{await frame(t)}", t)
            im = Image.open(io.BytesIO(grab(pg, 0.8))).resize((tw, th))
            x, y = (i % cols) * tw, (i // cols) * (th + 22)
            sheet.paste(im, (x, y + 22)); dr.text((x + 6, y + 4), f"{t:.1f}s", fill="#fff")
        sheet.save(d / "sheet.jpg", quality=85); print(d / "sheet.jpg")
        show_logs(logs); b.close()

    elif mode == "video":
        prev = "--preview" in args
        subprocess.run([sys.executable, str(ROOT / "scripts" / "mix.py"), str(d)], check=True)
        fps = 15 if prev else 30
        size = "540:960" if prev else "1080:1920"
        out = d / ("preview.mp4" if prev else "hq.mp4")
        b, pg, logs = page(pw)
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                                "-i", str(d / "mix.wav"), "-vf", f"scale={size}:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast" if prev else "medium",
                                "-b:v", "1500k" if prev else "12M", "-maxrate", "16M", "-bufsize", "24M", "-pix_fmt", "yuv420p",
                                "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        N = int(round(TL["end"] * fps)); t0 = time.time()
        for f in range(N):
            pg.evaluate("async t=>{await frame(t)}", f / fps)
            enc.stdin.write(grab(pg, 0.8 if prev else 0.93))
            if f % (fps * 5) == 0:
                el = time.time() - t0
                print(f"кадр {f}/{N}  {el:.0f} с" + (f", осталось ~{el / max(f, 1) * (N - f):.0f} с" if f else ""), flush=True)
        enc.stdin.close(); enc.wait()
        show_logs(logs); b.close()
        if not prev:
            subprocess.run(["sh", str(ROOT / "scripts" / "finish.sh"), str(out), str(d / "final.mp4")], check=True)
            out = d / "final.mp4"
        print(f"готово: {out}  {out.stat().st_size / 1e6:.1f} МБ, {time.time() - t0:.0f} с")
srv.shutdown()
