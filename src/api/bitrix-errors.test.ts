import { describe, expect, it } from 'vitest';
import { mapBitrixError } from './bitrix-errors.js';

describe('mapBitrixError', () => {
  it.each([
    ['insufficient_scope', 401, 'APP_B24_SCOPE_MISSING'],
    ['BITRIX_REST_V3_EXCEPTION_INSUFFICIENTSCOPEEXCEPTION', 403, 'APP_B24_SCOPE_MISSING'],
    ['INVALID_CREDENTIALS', 401, 'APP_B24_AUTH_FAILED'],
    ['NO_AUTH_FOUND', 401, 'APP_B24_AUTH_FAILED'],
    ['expired_token', 401, 'APP_B24_AUTH_FAILED'],
    ['ACCESS_DENIED', 401, 'APP_B24_REST_UNAVAILABLE'],
    ['ACCESS_DENIED', 403, 'APP_B24_ACCESS_DENIED'],
    ['ACCESS_ERROR', 403, 'APP_B24_ACCESS_DENIED'],
    ['access_denied', 403, 'APP_B24_ACCESS_DENIED'],
    ['BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', 403, 'APP_B24_ACCESS_DENIED'],
    ['ERROR_METHOD_NOT_FOUND', 404, 'APP_B24_METHOD_UNAVAILABLE'],
    ['ERROR_NOT_FOUND', 400, 'APP_B24_NOT_FOUND'],
    ['not_found', 404, 'APP_B24_NOT_FOUND'],
    ['BITRIX_REST_V3_EXCEPTION_ENTITYNOTFOUNDEXCEPTION', 400, 'APP_B24_NOT_FOUND'],
    ['QUERY_LIMIT_EXCEEDED', 503, 'APP_B24_RATE_LIMITED'],
    ['OPERATION_TIME_LIMIT', 429, 'APP_B24_METHOD_TIME_LIMIT'],
    ['OVERLOAD_LIMIT', 401, 'APP_B24_BLOCKED'],
    ['DIALOG_ID_EMPTY', 400, 'APP_B24_BAD_REQUEST'],
    ['LAST_ID_STRING', 400, 'APP_B24_BAD_REQUEST'],
    ['100', 400, 'APP_B24_BAD_REQUEST'],
    ['500', 400, 'APP_B24_BAD_REQUEST'],
    ['', 400, 'APP_B24_BAD_REQUEST'],
    ['', 403, 'APP_B24_ACCESS_DENIED'],
    ['', 404, 'APP_B24_NOT_FOUND'],
    ['SOMETHING_NEW', 403, 'APP_B24_ACCESS_DENIED'],
    ['', 502, 'APP_B24_PORTAL_ERROR'],
    ['invalid_date_range', 400, 'APP_B24_BAD_REQUEST'],
    ['WRONG_ARGUMENTS', 400, 'APP_B24_BAD_REQUEST'],
    ['ERROR_ARGUMENT', 400, 'APP_B24_BAD_REQUEST'],
    ['BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION', 400, 'APP_B24_BAD_REQUEST'],
    ['INTERNAL_SERVER_ERROR', 500, 'APP_B24_PORTAL_ERROR'],
  ])('%s + %i → %s', (code, status, expected) => {
    expect(mapBitrixError({ code, status, method: 'im.recent.list' }).code).toBe(expected);
  });

  it('без права называет право и раздел', () => {
    const err = mapBitrixError({ code: 'insufficient_scope', status: 401, method: 'mail.message.list' });
    expect(err.userMessage).toBe('У вебхука нет права «mail» — раздел «почта» недоступен. Добавьте право в настройках вебхука.');
  });

  it('лимит времени метода называет время сброса', () => {
    const resetAt = Date.UTC(2026, 10, 13, 12, 30) / 1000;
    const err = mapBitrixError({ code: 'OPERATION_TIME_LIMIT', status: 429, method: 'im.recent.list', operatingResetAt: resetAt });
    expect(err.userMessage).toMatch(/^Битрикс24 временно ограничил этот раздел из-за объёма запросов\. Повторите после \d{2}:\d{2}\.$/);
  });

  it('пустой код с текстом «Not found» — APP_B24_NOT_FOUND, «Access denied» — APP_B24_ACCESS_DENIED', () => {
    expect(mapBitrixError({ code: '', status: 400, method: 'tasks.task.get', description: 'Not found' }).code).toBe('APP_B24_NOT_FOUND');
    expect(mapBitrixError({ code: '', status: 400, method: 'calendar.event.getbyid', description: 'Access denied' }).code).toBe(
      'APP_B24_ACCESS_DENIED',
    );
  });

  it('лимит времени без известного времени сброса — «через несколько минут»', () => {
    const err = mapBitrixError({ code: 'OPERATION_TIME_LIMIT', status: 429, method: 'im.recent.list' });
    expect(err.userMessage).toBe('Битрикс24 временно ограничил этот раздел из-за объёма запросов. Повторите через несколько минут.');
  });

  it('отклонённые параметры перечисляет поля из validation', () => {
    const err = mapBitrixError({
      code: 'BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION',
      status: 400,
      method: 'mail.message.get',
      fields: ['id'],
    });
    expect(err.userMessage).toBe('Битрикс24 отклонил параметры запроса: id. Исправьте параметры команды.');
  });

  it('исходный код и текст Битрикса — только в details', () => {
    const err = mapBitrixError({ code: 'INTERNAL', status: 500, method: 'im.recent.list', description: 'Ошибка ядра' });
    expect(err.userMessage).not.toContain('INTERNAL');
    expect(err.details).toEqual(expect.objectContaining({ bitrixCode: 'INTERNAL', status: 500, description: 'Ошибка ядра' }));
  });
});
