/**
 * Прикладная ошибка со стабильным кодом и русскоязычным сообщением.
 *
 * code — стабильный код для поддержки (APP_B24_*, APP_CLI_*); userMessage —
 * понятный человеку текст на русском; details — технические подробности, видны
 * только при B24_DEBUG=1 и всегда проходят через redact(); cause — исходная ошибка.
 */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly details?: unknown;

  constructor(params: { code: string; userMessage: string; details?: unknown; cause?: unknown }) {
    super(`${params.code}: ${params.userMessage}`, { cause: params.cause });
    this.name = 'AppError';
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.details = params.details;
  }
}
