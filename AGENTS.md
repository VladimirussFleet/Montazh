# AGENTS.md — для Codex и других агентов

Основная инструкция — `CLAUDE.md`, прочитай её целиком и действуй так же. Отличия, если ты не Claude:

- Страница «Монтажный стол», примерочная стиля и «Попросить Claude» работают только в Claude (артефакты). Пропусти шаги с `Artifact` и `ArtifactData`.
- Стиль хранится прямо в папке `brand/` у человека на диске (`brand.json` и `brand.md`), страница и `scripts/brand_sync.py` не нужны. Правила допиши в `brand/brand.md`, цифры в `brand/brand.json`. Если человек принёс `мой_стиль.json` из Claude: `python3 scripts/brand_sync.py pull мой_стиль.json`.
- Согласовывай в чате: строки текста с номерами, затем стоп-кадры (`python3 scripts/render.py stills …` или `render.py sheet`), затем превью.
- Стиль подбирай так: поменяй `brand/brand.json`, отрендерь 3–4 варианта стоп-кадрами, покажи и спроси, какой ближе (шаг 5 в `docs/brand-interview.md`).
- Установка на Mac: `sh scripts/setup.sh` (нужен Homebrew). Модели качаются с GitHub, это ~170 МБ.
