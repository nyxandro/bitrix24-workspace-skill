#!/usr/bin/env bash
#
# Установщик скилла bitrix24-workspace (Linux, macOS, WSL).
#   curl -fsSL https://raw.githubusercontent.com/nyxandro/bitrix24-workspace-skill/main/install.sh | bash
#   bash install.sh --file bitrix24-workspace.skill [--dir <папка скиллов агента>]
#
# Что делает:
#   1. Берёт архив скилла: скачивает с GitHub или из --file (для машин без доступа в интернет).
#   2. Кладёт скилл в ~/.agents/skills/bitrix24-workspace, а в ~/.claude/skills — ссылку на него
#      (одна копия на все агенты). --dir — ещё одна папка скиллов (Hermes и др.), можно повторять.
#   3. Создаёт ~/.config/bitrix24-workspace/.env — пустой шаблон для адреса вебхука с правами 600.
#      Существующий файл не трогает.
#
# Адрес вебхука вписываешь сам — это секрет, в чат с ИИ его не присылают.
set -euo pipefail

REPO="nyxandro/bitrix24-workspace-skill"
REF="main"
NAME="bitrix24-workspace"
URL="https://raw.githubusercontent.com/${REPO}/${REF}/${NAME}.skill"
AGENTS_DIR="$HOME/.agents/skills"
CLAUDE_DIR="$HOME/.claude/skills"
CONFIG_DIR="$HOME/.config/bitrix24-workspace"
ENV_FILE="$CONFIG_DIR/.env"

info() { printf '%s\n' "$*"; }
die() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }

FILE=""
EXTRA_DIRS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --file) [ $# -ge 2 ] || die "у --file не указан путь к архиву"; FILE="$2"; shift 2 ;;
    --dir) [ $# -ge 2 ] || die "у --dir не указана папка"; EXTRA_DIRS+=("$2"); shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) die "неизвестный параметр «$1». Справка: bash install.sh --help" ;;
  esac
done

command -v unzip >/dev/null 2>&1 || die "нужен unzip — установи его и повтори."
if ! command -v node >/dev/null 2>&1; then
  info "⚠️  Node.js не найден. Скилл поставлю, но программа не запустится без Node.js 20.19 или новее (nodejs.org, LTS)."
elif [ "$(node -p 'const [a,b]=process.versions.node.split(".").map(Number); a>20||(a===20&&b>=19)?1:0' 2>/dev/null || echo 0)" != "1" ]; then
  info "⚠️  Node.js старее 20.19. Скилл поставлю, но обнови Node, иначе программа не запустится."
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
archive="$tmp/${NAME}.skill"
if [ -n "$FILE" ]; then
  [ -f "$FILE" ] || die "архив не найден: $FILE"
  cp "$FILE" "$archive"
  info "Ставлю из файла: $FILE"
else
  info "Скачиваю ${NAME}.skill…"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$archive" "$URL" || die "не удалось скачать $URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$archive" "$URL" || die "не удалось скачать $URL"
  else
    die "нужен curl или wget (или поставь из файла: --file <архив>)."
  fi
fi
unzip -l "$archive" "${NAME}/SKILL.md" >/dev/null 2>&1 || die "это не архив скилла ${NAME}: внутри нет ${NAME}/SKILL.md"

install_into() {
  mkdir -p "$1"
  rm -rf "${1:?}/${NAME}"
  unzip -q "$archive" -d "$1"
  info "✓ скилл: $1/${NAME}"
}

install_into "$AGENTS_DIR"
# В ~/.claude/skills — ссылка на ту же копию: обновление в одном месте. Если сама папка
# ~/.claude/skills ведёт в ~/.agents/skills, скилл там уже есть — ничего не трогаем,
# иначе удалили бы только что поставленную копию.
mkdir -p "$CLAUDE_DIR"
if [ "$(cd "$CLAUDE_DIR" && pwd -P)" = "$(cd "$AGENTS_DIR" && pwd -P)" ]; then
  info "✓ $CLAUDE_DIR ведёт в $AGENTS_DIR — скилл виден и Claude Code"
else
  rm -rf "${CLAUDE_DIR:?}/${NAME}"
  ln -s "../../.agents/skills/${NAME}" "$CLAUDE_DIR/${NAME}"
  info "✓ ссылка для Claude Code: $CLAUDE_DIR/${NAME}"
fi
for dir in ${EXTRA_DIRS[@]+"${EXTRA_DIRS[@]}"}; do
  install_into "$dir"
done

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [ -f "$ENV_FILE" ]; then
  info "• $ENV_FILE уже есть — не трогаю."
else
  cat > "$ENV_FILE" <<'TEMPLATE'
# Адрес входящего вебхука Битрикс24 — секрет, в чат с ИИ не присылать.
# Как создать вебхук и какие права дать: references/setup.md в папке скилла.
BITRIX24_WORKSPACE_WEBHOOK_URL=
TEMPLATE
  chmod 600 "$ENV_FILE"
  info "✓ создан $ENV_FILE — впиши в него адрес вебхука."
fi

info ""
info "Готово. Дальше:"
info "  1) Создай входящий вебхук и впиши адрес в $ENV_FILE (инструкция: $AGENTS_DIR/${NAME}/references/setup.md)."
info "  2) Перезапусти сессию агента — скилл «${NAME}» подхватится сам."
