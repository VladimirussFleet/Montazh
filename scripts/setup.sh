#!/bin/sh
# Установка всего нужного. Запускает Claude в начале каждой новой сессии (облачная песочница каждый раз чистая).
#   sh scripts/setup.sh        -> ffmpeg, rubberband, шрифты, Python-пакеты, Chromium, модель русской речи (~170 МБ)
#   sh scripts/setup.sh --en   -> плюс английская модель (~480 МБ), для роликов на английском
# Повторный запуск ничего не скачивает заново.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
need() { command -v "$1" >/dev/null 2>&1; }

# 1. ffmpeg + rubberband (растяжение речи без «робота»)
if ! need ffmpeg || ! need rubberband; then
  if [ "$(uname)" = "Darwin" ]; then
    need brew || { echo "Нужен Homebrew: https://brew.sh"; exit 1; }
    brew install ffmpeg rubberband
  else
    SUDO=""; [ "$(id -u)" = "0" ] || SUDO=sudo
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq ffmpeg rubberband-cli fonts-noto-color-emoji >/dev/null
  fi
fi

# 2. шрифты (Google Fonts с кириллицей)
[ -d node_modules/@fontsource/montserrat ] || npm install --silent --no-audit --no-fund

# 3. Python: распознавание речи, браузер для рендера
PIP="python3 -m pip install -q"
python3 -c "import sherpa_onnx, numpy, PIL, playwright" 2>/dev/null || \
  $PIP sherpa-onnx numpy pillow playwright 2>/dev/null || $PIP --break-system-packages sherpa-onnx numpy pillow playwright
python3 - <<'PY' 2>/dev/null || python3 -m playwright install chromium
from playwright.sync_api import sync_playwright
with sync_playwright() as p: p.chromium.launch().close()
PY

# 4. модели распознавания (GitHub releases проекта sherpa-onnx)
mkdir -p models; cd models
get() { [ -d "$1" ] || { echo "качаю $1"; curl -sSL -o m.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$1.tar.bz2" && tar xjf m.tar.bz2 && rm m.tar.bz2; }; }
get sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19
[ "$1" = "--en" ] && get sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8
cd "$ROOT"
python3 scripts/doctor.py
