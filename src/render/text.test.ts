import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bbToText, isSystemMessage, truncate } from './text.js';

describe('bbToText', () => {
  it('упоминание с именем → @имя', () => {
    expect(bbToText('Привет, [USER=669 REPLACE]Иванов Иван[/USER]!')).toBe('Привет, @Иванов Иван!');
    expect(bbToText('[USER=7]Петров[/USER]')).toBe('@Петров');
  });

  it('пустое упоминание берёт имя из списка авторов', () => {
    expect(bbToText('[USER=7][/USER] ок', new Map([[7, 'Пётр Петров']]))).toBe('@Пётр Петров ок');
    expect(bbToText('[USER=8][/USER]')).toBe('@сотрудник 8');
  });

  it('ссылки', () => {
    expect(bbToText('[URL=https://x.ru]сайт[/URL]')).toBe('сайт (https://x.ru)');
    expect(bbToText('[URL]https://x.ru[/URL]')).toBe('https://x.ru');
    expect(bbToText('[URL=https://x.ru]https://x.ru[/URL]')).toBe('https://x.ru');
  });

  it('цитата → строки с «> »', () => {
    expect(bbToText('[QUOTE]первая\nвторая[/QUOTE]\nответ')).toBe('> первая\n> вторая\nответ');
  });

  it('оформление убирается, [br] — перевод строки, сущности раскодируются', () => {
    expect(bbToText('[B]жирно[/B] [i]курсив[/i] [COLOR=#ff0000]красный[/COLOR][br]строка &quot;x&quot; &amp; y')).toBe(
      'жирно курсив красный\nстрока "x" & y',
    );
  });

  it('списки и таблицы не склеиваются', () => {
    expect(bbToText('[LIST][*]первое[*]второе[/LIST]')).toBe('- первое\n- второе');
    expect(bbToText('[TABLE][TR][TD]Сумма[/TD][TD]100[/TD][/TR][TR][TD]НДС[/TD][TD]20[/TD][/TR][/TABLE]')).toBe('Сумма | 100\nНДС | 20');
  });

  it('внутри [CODE] ничего не разбирается', () => {
    expect(bbToText('код: [CODE]arr[i] = [B]x[/B][/CODE]')).toBe('код: arr[i] = [B]x[/B]');
  });

  it('[TIMESTAMP] → дата в зоне читателя', () => {
    expect(bbToText('встреча [TIMESTAMP=1789000000 FORMAT=SHORT_TIME_FORMAT]', new Map(), 'Europe/Moscow')).toBe(
      'встреча 2026-09-10T03:26:40+03:00',
    );
  });

  it('квадратные скобки в обычном тексте не трогаются', () => {
    expect(bbToText('пункт [1] и [ссылка] и [OK]')).toBe('пункт [1] и [ссылка] и [OK]');
  });

  it('одиночные [i], [b], [s], [u], [p] без пары — обычный текст, а не разметка', () => {
    expect(bbToText('в цикле a[i] = b[i] + x[s]; см. пункт [P] и [b], [u]')).toBe('в цикле a[i] = b[i] + x[s]; см. пункт [P] и [b], [u]');
    expect(bbToText('итог [/b] без начала')).toBe('итог [/b] без начала');
  });

  it('парное оформление убирается: вложенное и в разном регистре', () => {
    expect(bbToText('[B][I]важно[/I][/B] и [b]жирно[/B], [s]зачёркнуто[/s], [P]абзац[/P]')).toBe('важно и жирно, зачёркнуто, абзац');
  });

  it('сотни тысяч знаков с одиночными [i] разбираются быстро', () => {
    const text = 'a[i] = b[i]; '.repeat(60_000);
    const started = performance.now();
    expect(bbToText(text)).toBe(text);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it('property: не падает на любой строке и не оставляет закрывающих тегов из набора', () => {
    const tag = fc.constantFrom('[B]', '[/B]', '[USER=1]', '[/USER]', '[URL=x]', '[/URL]', '[QUOTE]', '[/QUOTE]', '[br]', '[TD]', '[/TD]');
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.string(), tag)), (parts) => {
        const out = bbToText(parts.join(''));
        expect(typeof out).toBe('string');
        expect(out).not.toMatch(/\[\/(USER|URL|CODE)\]/i);
      }),
    );
  });
});

describe('bbToText: [CODE]', () => {
  it('property: содержимое [CODE] не меняется', () => {
    fc.assert(
      fc.property(
        fc.string().filter((x) => !/\[\/CODE\]/i.test(x) && !x.endsWith('\n')),
        (body) => {
          expect(bbToText(`[CODE]${body}[/CODE]`)).toBe(body);
        },
      ),
    );
  });

  it('заглушка без пары в обычном тексте не съедает текст', () => {
    expect(bbToText('a\uE0007\uE000b')).toBe('a\uE0007\uE000b');
  });
});

describe('isSystemMessage', () => {
  it('автор 0 и служебные коды — системные', () => {
    expect(isSystemMessage({ authorId: 0 })).toBe(true);
    expect(isSystemMessage({ authorId: 5, code: 'CHAT_JOIN' })).toBe(true);
    expect(isSystemMessage({ authorId: 5 })).toBe(false);
  });
});

describe('truncate', () => {
  it('обрезает до лимита и отмечает это', () => {
    const r = truncate('а'.repeat(10_000), 4000);
    expect(Array.from(r.text)).toHaveLength(4000);
    expect(r.truncated).toBe(true);
  });

  it('короткий текст не трогает', () => {
    expect(truncate('коротко', 4000)).toEqual({ text: 'коротко', truncated: false });
  });

  it('не разрезает эмодзи пополам', () => {
    const r = truncate('😀😀😀', 2);
    expect(r.text).toBe('😀😀');
  });
});
