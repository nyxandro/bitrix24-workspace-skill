/**
 * Тело письма → текст. Формат тела в REST не описан: HTML переводим в текст,
 * обычный текст отдаём как есть (иначе конвертер склеил бы строки).
 */
import { convert } from 'html-to-text';

const HTML_TAG_RE = /<\/?(?:html|head|body|div|p|br|table|tbody|thead|tr|td|th|span|a|font|ul|ol|li|h[1-6]|blockquote|img|strong|b|i|u|em|style|meta|center|hr)\b[^>]*>/i;

export function looksLikeHtml(body: string): boolean {
  return HTML_TAG_RE.test(body);
}

export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
    ],
  }).trim();
}

export function mailBodyToText(body: string): string {
  return looksLikeHtml(body) ? htmlToText(body) : body;
}
