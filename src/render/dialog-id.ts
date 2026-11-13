/**
 * Идентификатор диалога для методов чата (DIALOG_ID):
 * chat<N> — групповой чат, чат задачи или встречи; sg<N> — чат проекта по номеру
 * группы; голое число — личка с сотрудником.
 *
 * В ответах Битрикса id недавнего чата бывает уже с приставкой «chat» — если
 * добавить её ещё раз, получится «chatchat…» и ошибка доступа.
 */
import { AppError } from '../api/errors.js';

const PRIVATE_TYPES = new Set(['user', 'private', 'bot']);

export function normalizeDialogId(raw: string | number, type?: string): string {
  const value = String(raw).trim();
  if (/^(?:chat|sg)\d+$/.test(value)) {
    return value;
  }
  const user = /^user(\d+)$/.exec(value);
  if (user) {
    return user[1] as string;
  }
  // Голое число без типа неоднозначно: это может быть и номер чата, и номер
  // сотрудника — молча читать не тот диалог нельзя.
  if (/^\d+$/.test(value) && type !== undefined) {
    return PRIVATE_TYPES.has(type) ? value : `chat${value}`;
  }
  throw new AppError({
    code: 'APP_B24_UNEXPECTED_RESPONSE',
    userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
    details: { field: 'dialogId', type },
  });
}

export function parseDialogIdArg(raw: string): string {
  const value = raw.trim();
  if (/^(?:chat|sg)\d+$/.test(value) || /^\d+$/.test(value)) {
    return value;
  }
  throw new AppError({
    code: 'APP_CLI_INVALID_ARGUMENT',
    userMessage: `Параметр dialogId: ожидается chat<номер>, sg<номер проекта> или номер сотрудника для лички, получено «${raw}».`,
  });
}
