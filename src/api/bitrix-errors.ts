/**
 * Перевод ошибок Битрикс24 в коды APP_B24_* с понятным русским текстом.
 *
 * Различаем по паре «код ошибки + HTTP-статус» (документация error-codes.md):
 * системные ошибки авторизации приходят со статусом 401, ошибки методов — 400/403.
 * Исходные код и текст Битрикса кладутся только в details (видны при B24_DEBUG).
 */
import { scopeForMethod, SCOPE_SECTIONS } from './allowlist.js';
import { AppError } from './errors.js';

export interface BitrixErrorInput {
  code: string;
  status: number;
  method: string;
  description?: string;
  fields?: string[];
  operatingResetAt?: number;
}

const AUTH_CODES = new Set(['INVALID_CREDENTIALS', 'NO_AUTH_FOUND', 'INVALID_TOKEN', 'EXPIRED_TOKEN', 'WRONG_AUTH_TYPE']);
const BAD_REQUEST_CODES = new Set(['ERROR_ARGUMENT', 'WRONG_ARGUMENTS', 'INVALID_ARGUMENT', 'INVALID_REQUEST']);

function resetTime(epochSeconds: number | undefined): string {
  if (epochSeconds === undefined || !Number.isFinite(epochSeconds)) {
    return 'через несколько минут';
  }
  const d = new Date(epochSeconds * 1000);
  return `после ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isBadRequestCode(upper: string): boolean {
  return (
    BAD_REQUEST_CODES.has(upper) ||
    upper.startsWith('INVALID_') ||
    upper.endsWith('_EMPTY') ||
    upper.endsWith('_STRING') ||
    upper.includes('VALIDATION') ||
    upper.includes('INVALIDJSON') ||
    upper.includes('UNKNOWNDTOPROPERTY') ||
    upper.includes('UNKNOWNFILTEROPERATOR')
  );
}

export function mapBitrixError(input: BitrixErrorInput): AppError {
  const upper = input.code.trim().toUpperCase();
  const description = input.description ?? '';
  const details = { bitrixCode: input.code, status: input.status, method: input.method, description: input.description };
  const make = (code: string, userMessage: string) => new AppError({ code, userMessage, details });

  const accessDenied = () =>
    make('APP_B24_ACCESS_DENIED', 'Нет доступа: вы не участник этого чата или у вас нет прав на этот объект в Битрикс24.');
  const notFound = () => make('APP_B24_NOT_FOUND', 'Не найдено: такого объекта нет или он удалён. Проверьте номер.');
  const badRequest = () => {
    const fields = input.fields && input.fields.length > 0 ? `: ${input.fields.join(', ')}` : '';
    return make('APP_B24_BAD_REQUEST', `Битрикс24 отклонил параметры запроса${fields}. Исправьте параметры команды.`);
  };

  // Системные ограничения проверяются раньше общего правила «401 — авторизация»:
  // OVERLOAD_LIMIT тоже приходит со статусом 401 (system-errors.md).
  if (upper === 'OVERLOAD_LIMIT') {
    return make('APP_B24_BLOCKED', 'Битрикс24 заблокировал запросы к порталу. Повторять бесполезно — обратитесь в поддержку Битрикс24.');
  }
  if (upper === 'QUERY_LIMIT_EXCEEDED') {
    return make('APP_B24_RATE_LIMITED', 'Битрикс24 временно ограничил частоту запросов. Повторите через несколько секунд.');
  }
  if (upper === 'OPERATION_TIME_LIMIT') {
    return make(
      'APP_B24_METHOD_TIME_LIMIT',
      `Битрикс24 временно ограничил этот раздел из-за объёма запросов. Повторите ${resetTime(input.operatingResetAt)}.`,
    );
  }
  if (upper === 'ACCESS_DENIED' && input.status === 401) {
    return make(
      'APP_B24_REST_UNAVAILABLE',
      'На тарифе портала Битрикс24 недоступен REST API — скилл работать не может. Нужен коммерческий тариф.',
    );
  }
  if (upper === 'INSUFFICIENT_SCOPE' || upper.includes('INSUFFICIENTSCOPE')) {
    const scope = scopeForMethod(input.method) ?? 'нужное право';
    const section = SCOPE_SECTIONS[scope] ?? input.method;
    return make(
      'APP_B24_SCOPE_MISSING',
      `У вебхука нет права «${scope}» — раздел «${section}» недоступен. Добавьте право в настройках вебхука.`,
    );
  }
  if (AUTH_CODES.has(upper) || input.status === 401) {
    return make(
      'APP_B24_AUTH_FAILED',
      'Портал не принял ключ доступа: вебхук удалён, у него истёк срок или изменился код. Создайте новый вебхук и замените адрес в файле настроек.',
    );
  }
  if (upper === 'ERROR_METHOD_NOT_FOUND') {
    return make(
      'APP_B24_METHOD_UNAVAILABLE',
      'Метод Битрикс24 недоступен: у вебхука нет нужного права или портал не поддерживает этот раздел. Проверьте права вебхука командой status.',
    );
  }
  if (upper.includes('ACCESS_DENIED') || upper === 'ACCESS_ERROR' || upper.includes('ACCESSDENIED')) {
    return accessDenied();
  }
  if (upper.includes('NOT_FOUND') || upper.includes('NOTFOUND')) {
    return notFound();
  }
  if (isBadRequestCode(upper)) {
    return badRequest();
  }
  // Код пустой, числовой или незнакомый: ошибка метода, повтор даст то же самое
  // (error-codes.md). Решаем по тексту и HTTP-статусу.
  if (/not\s*found|не\s*найден/i.test(description)) {
    return notFound();
  }
  if (/access\s*denied|нет\s*доступа|доступ\s*запрещ/i.test(description)) {
    return accessDenied();
  }
  if (input.status === 403) {
    return accessDenied();
  }
  if (input.status === 404) {
    return notFound();
  }
  if (input.status === 400) {
    return badRequest();
  }
  return make('APP_B24_PORTAL_ERROR', 'Битрикс24 вернул ошибку при выполнении запроса. Повторите позже.');
}
