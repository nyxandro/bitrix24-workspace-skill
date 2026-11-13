/**
 * Константы проекта: версия, пути, имена переменных, лимиты и таймауты.
 *
 * Политика окружения: в .env хранится только секрет — адрес входящего вебхука.
 * Всё поведенческое (лимиты, таймауты, размеры порций) — именованные константы
 * здесь, а не переменные окружения.
 */
import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'bitrix24-workspace-skill';
export const APP_VERSION = '0.1.0';
export const CLI_NAME = 'b24';

// Свой каталог и своя переменная: не пересекаемся с чужими скиллами «bitrix24»,
// у которых переменная BITRIX24_WEBHOOK_URL.
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'bitrix24-workspace');
export const ENV_PATH = path.join(CONFIG_DIR, '.env');
// Так путь показывается человеку в подсказках — одинаково на любой машине.
export const ENV_PATH_DISPLAY = '~/.config/bitrix24-workspace/.env';
export const WEBHOOK_ENV = 'BITRIX24_WORKSPACE_WEBHOOK_URL';
export const DEBUG_ENV = 'B24_DEBUG';
