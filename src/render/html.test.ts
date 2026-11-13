import { describe, expect, it } from 'vitest';
import { htmlToText, looksLikeHtml, mailBodyToText } from './html.js';

describe('html', () => {
  it('отличает HTML от обычного текста', () => {
    expect(looksLikeHtml('<div>Привет</div>')).toBe(true);
    expect(looksLikeHtml('<p>Абзац')).toBe(true);
    expect(looksLikeHtml('Обычный текст\nс переводами строк и 2 < 3')).toBe(false);
  });

  it('HTML с таблицей и стилями → текст без тегов и стилей', () => {
    const out = htmlToText('<html><head><style>.x{color:red}</style></head><body><p>Добрый день</p><table><tr><td>Сумма</td><td>100</td></tr></table></body></html>');
    expect(out).toContain('Добрый день');
    expect(out).toContain('Сумма');
    expect(out).not.toContain('<');
    expect(out).not.toContain('color:red');
  });

  it('обычный текст письма сохраняет строки', () => {
    expect(mailBodyToText('строка 1\nстрока 2\n\nстрока 4')).toBe('строка 1\nстрока 2\n\nстрока 4');
  });
});
