#!/usr/bin/env python3
"""Упаковка скилла bitrix24-workspace в устанавливаемый архив ``bitrix24-workspace.skill``.

.skill — это ZIP-архив, который распаковывается в каталог скиллов агента
(``~/.agents/skills/``, ``~/.claude/skills/`` или другой). Все файлы лежат под
общим верхним каталогом ``bitrix24-workspace/``.

В пакет попадает только то, что нужно агенту в работе: инструкция ``SKILL.md``,
самодостаточный бандл ``scripts/b24.cjs`` и справочники ``references/``.
Разработческие артефакты (evals, тесты) в пакет не попадают.

Архив пишется детерминированно (фиксированная метка времени, сортировка
записей): при неизменном содержимом байты не меняются.

Запуск: ``npm run pack:skill`` (или ``python3 scripts/pack-skill.py``).
"""

import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_NAME = "bitrix24-workspace"
SKILL_DIR = REPO_ROOT / "skills" / SKILL_NAME
OUTPUT = REPO_ROOT / f"{SKILL_NAME}.skill"

# Явный список, а не обход каталога: случайные файлы не утекут в выпуск.
CONTENTS = [
    "SKILL.md",
    "scripts/b24.cjs",
    "references/json-fields.md",
    "references/setup.md",
]

FIXED_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


def build() -> None:
    missing = [rel for rel in CONTENTS if not (SKILL_DIR / rel).is_file()]
    if missing:
        hint = "сначала `npm run build:skill`" if "scripts/b24.cjs" in missing else f"проверьте skills/{SKILL_NAME}/"
        raise SystemExit(
            f"APP_PACK_SKILL_MISSING_FILES: не найдены файлы скилла: {', '.join(missing)}. Что делать: {hint}."
        )

    OUTPUT.unlink(missing_ok=True)

    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(CONTENTS):
            info = zipfile.ZipInfo(f"{SKILL_NAME}/{rel}", date_time=FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, (SKILL_DIR / rel).read_bytes())

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"{OUTPUT.name} собран: {len(CONTENTS)} файла, {size_kb:.1f} КБ")


if __name__ == "__main__":
    try:
        build()
    except SystemExit:
        raise
    except OSError as exc:
        print(f"APP_PACK_SKILL_IO_ERROR: не удалось собрать пакет: {exc}", file=sys.stderr)
        raise
