/**
 * Разбор и проверка адреса входящего вебхука Битрикс24.
 *
 * Ожидаемый вид: https://<портал>/rest/<номер пользователя>/<код>/ — без имени
 * метода, параметров и якоря. Адрес — секрет: ни он, ни код не попадают в
 * сообщения об ошибках.
 */
import { AppError } from '../api/errors.js';
import { ENV_PATH_DISPLAY, WEBHOOK_ENV } from './config.js';

export interface Webhook {
  origin: string;
  userId: number;
  code: string;
}

const WEBHOOK_PATH_RE = /^\/rest\/(\d+)\/([A-Za-z0-9]+)\/?$/;
const WRAPPING_QUOTES_RE = /^(['"])(.*)\1$/s;

function invalid(): AppError {
  return new AppError({
    code: 'APP_B24_WEBHOOK_INVALID',
    userMessage:
      'Адрес вебхука указан неверно: ожидается вид https://портал/rest/номер/код/. Скопируйте адрес из настроек вебхука заново.',
  });
}

export function parseWebhook(raw: string | undefined): Webhook {
  const trimmed = (raw ?? '').trim();
  const unquoted = trimmed.replace(WRAPPING_QUOTES_RE, '$2').trim();
  if (unquoted === '') {
    throw new AppError({
      code: 'APP_B24_WEBHOOK_MISSING',
      userMessage: `Не задан адрес вебхука Битрикс24. Создайте входящий вебхук и впишите его в ${ENV_PATH_DISPLAY} в строку ${WEBHOOK_ENV}=.`,
    });
  }

  let url: URL;
  try {
    url = new URL(unquoted);
  } catch {
    throw invalid();
  }
  if (url.protocol !== 'https:' || url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    throw invalid();
  }
  const match = WEBHOOK_PATH_RE.exec(url.pathname);
  if (!match) {
    throw invalid();
  }
  const userId = Number(match[1]);
  const code = match[2] as string;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw invalid();
  }
  return { origin: url.origin, userId, code };
}
