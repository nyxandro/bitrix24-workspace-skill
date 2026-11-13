/**
 * Финальная проверка вывода перед печатью.
 *
 * Ответы команд собираются из явного списка полей, но в самих текстах (сообщения,
 * письма) могут встретиться ссылки с ключами. Их значения заменяются на
 * «<скрыто>» в каждой строке-значении до сборки JSON — так кавычки и переводы
 * строк в тексте не ломают ни JSON, ни соседний текст. Если в выводе оказался
 * код вебхука (например, его вставили в чат), ответ не печатается вовсе.
 */
import { AppError } from '../api/errors.js';
import { redact } from '../api/redact.js';

export interface Envelope {
  data: unknown;
  next: string | null;
  notes: string[];
}

export const REDACTED_NOTE = 'В тексте скрыты значения, похожие на ключи доступа (token=, auth= и т. п.).';

function redactLeaves(value: unknown, onChange: () => void): unknown {
  if (typeof value === 'string') {
    const cleaned = redact(value, []);
    if (cleaned !== value) {
      onChange();
    }
    return cleaned;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLeaves(item, onChange));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactLeaves(item, onChange)]));
  }
  return value;
}

export function finalizeOutput(envelope: Envelope, secrets: readonly string[]): string {
  const raw = JSON.stringify(envelope);
  if (secrets.some((secret) => secret.trim() !== '' && raw.includes(secret.trim()))) {
    throw new AppError({
      code: 'APP_B24_SECRET_IN_OUTPUT',
      userMessage:
        'Ответ не показан: в нём оказался адрес вашего вебхука (например, его вставили в чат или письмо). Удалите этот вебхук в Битрикс24 и создайте новый.',
    });
  }
  let changed = false;
  const cleaned = redactLeaves(envelope, () => {
    changed = true;
  }) as Envelope;
  if (changed) {
    cleaned.notes = [...cleaned.notes, REDACTED_NOTE];
  }
  return JSON.stringify(cleaned, null, 2);
}
