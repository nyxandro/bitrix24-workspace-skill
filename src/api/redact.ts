/**
 * Вычистка секретов из любой строки перед выводом.
 *
 * Два вида секретов:
 * - код вебхука (и полный адрес) — передаются явно списком secrets;
 * - ключи в ссылках на скачивание и подписанных адресах: значения параметров
 *   auth, auth[auth] (в том числе закодированный auth%5Bauth%5D), token,
 *   signature, _esd. У вебхука такие ключи бессрочные, поэтому их нельзя
 *   показывать даже в отладке.
 */
export const HIDDEN = '<скрыто>';

// Имя параметра может стоять где угодно (в адресе, в тексте сообщения): лучше
// лишний раз скрыть значение «token=…» из чужого текста, чем пропустить ключ.
const SECRET_PARAM_RE = /((?:auth(?:\[auth\]|%5Bauth%5D)?|token|signature|_esd)=)([^&\s"'<>]+)/gi;

export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    const value = secret.trim();
    if (value === '') {
      continue;
    }
    out = out.split(value).join(HIDDEN);
  }
  return out.replace(SECRET_PARAM_RE, `$1${HIDDEN}`);
}
