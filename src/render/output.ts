/**
 * Финальная проверка вывода перед печатью.
 *
 * Ответы команд собираются из явного списка полей, но в самих текстах (сообщения,
 * письма) могут встретиться ссылки с ключами — их значения заменяются на
 * «<скрыто>» с пометкой. Если же в выводе оказался код вебхука, это ошибка
 * программы: ответ не печатается вовсе.
 */
import { AppError } from '../api/errors.js';
import { redact } from '../api/redact.js';

export interface Envelope {
  data: unknown;
  next: string | null;
  notes: string[];
}

export const REDACTED_NOTE = 'В тексте скрыты значения, похожие на ключи доступа (token=, auth= и т. п.).';

export function finalizeOutput(envelope: Envelope, secrets: readonly string[]): string {
  const json = JSON.stringify(envelope, null, 2);
  if (secrets.some((secret) => secret.trim() !== '' && json.includes(secret.trim()))) {
    throw new AppError({
      code: 'APP_B24_SECRET_IN_OUTPUT',
      userMessage: 'Ответ не показан: в нём оказался ключ доступа. Это ошибка программы — сообщите разработчику.',
    });
  }
  const cleaned = redact(json, []);
  if (cleaned === json) {
    return json;
  }
  const parsed = JSON.parse(cleaned) as Envelope;
  parsed.notes = [...parsed.notes, REDACTED_NOTE];
  return JSON.stringify(parsed, null, 2);
}
