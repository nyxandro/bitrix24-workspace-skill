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
    return 'нескольких минут';
  }
  const d = new Date(epochSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mapBitrixError(input: BitrixErrorInput): AppError {
  const upper = input.code.toUpperCase();
  const details = { bitrixCode: input.code, status: input.status, method: input.method, description: input.description };
  const make = (code: string, userMessage: string) => new AppError({ code, userMessage, details });

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
  if (upper === 'QUERY_LIMIT_EXCEEDED') {
    return make('APP_B24_RATE_LIMITED', 'Битрикс24 временно ограничил частоту запросов. Повторите через несколько секунд.');
  }
  if (upper === 'OPERATION_TIME_LIMIT') {
    return make(
      'APP_B24_METHOD_TIME_LIMIT',
      `Битрикс24 временно ограничил этот раздел из-за объёма запросов. Повторите после ${resetTime(input.operatingResetAt)}.`,
    );
  }
  if (upper === 'OVERLOAD_LIMIT') {
    return make('APP_B24_BLOCKED', 'Битрикс24 заблокировал запросы к порталу. Повторять бесполезно — обратитесь в поддержку Битрикс24.');
  }
  if (upper.includes('ACCESS_DENIED') || upper === 'ACCESS_ERROR' || upper.includes('ACCESSDENIED')) {
    return make('APP_B24_ACCESS_DENIED', 'Нет доступа: вы не участник этого чата или у вас нет прав на этот объект в Битрикс24.');
  }
  if (upper.includes('NOT_FOUND') || upper.includes('NOTFOUND')) {
    return make('APP_B24_NOT_FOUND', 'Не найдено: такого объекта нет или он удалён. Проверьте номер.');
  }
  if (
    BAD_REQUEST_CODES.has(upper) ||
    upper.startsWith('INVALID_') ||
    upper.includes('VALIDATION') ||
    upper.includes('INVALIDJSON') ||
    upper.includes('UNKNOWNDTOPROPERTY') ||
    upper.includes('UNKNOWNFILTEROPERATOR')
  ) {
    const fields = input.fields && input.fields.length > 0 ? `: ${input.fields.join(', ')}` : '';
    return make('APP_B24_BAD_REQUEST', `Битрикс24 отклонил параметры запроса${fields}. Исправьте параметры команды.`);
  }
  return make('APP_B24_PORTAL_ERROR', 'Битрикс24 вернул ошибку при выполнении запроса. Повторите позже.');
}
