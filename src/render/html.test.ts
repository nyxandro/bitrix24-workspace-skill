import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { htmlToText, looksLikeHtml, mailBody, mailBodyToText } from './html.js';

// Невидимые знаки — по кодам, чтобы в исходнике теста их было видно.
const [NBSP, SOFT_HYPHEN, CGJ, ZWSP, ZWNJ, ZWJ, WORD_JOINER, BOM] = [0xa0, 0xad, 0x34f, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].map((code) => String.fromCharCode(code)) as [string, string, string, string, string, string, string, string];

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
    expect(out).not.toContain('Сумма100');
  });

  it('обычный текст письма сохраняет строки', () => {
    expect(mailBodyToText('строка 1\nстрока 2\n\nстрока 4')).toBe('строка 1\nстрока 2\n\nстрока 4');
  });

  // Битрикс отдаёт тело письма уже без тегов, но содержимое блока <style> оставляет
  // текстом перед письмом (проверено на живом портале, mail.message.get).
  const LEAKED_CSS = [
    'body, html {\r\n        font-family: Roboto, Helvetica, Arial, sans-serif;\r\n      }',
    '',
    '      body {\r\n        margin: 0;\r\n        -webkit-font-smoothing: antialiased;\r\n      }',
    '      #outlook a {\r\n        padding: 0;\r\n      }',
    '      .ExternalClass * {\r\n        line-height: 100%;\r\n      }',
    '      table,\r\n      td {\r\n        mso-table-lspace: 0pt;\r\n      }',
    '      /* мобильная вёрстка */',
    '      @media only screen and (max-width: 600px) {\r\n        .wrap { width: 100% !important; }\r\n        a[href^="tel"] { color: inherit; }\r\n      }',
    '      @import url("https://fonts.example.com/css?family=Roboto");',
    '      @media (prefers-color-scheme: dark) {\r\n        .banner:not([class^="x_"]) {\r\n          background-color: #3c4043 !important; /* серый { со скобкой } */\r\n        }\r\n        .icon {\r\n          /* комментарий перед свойством */\r\n          background-image: url(\'https://fonts.example.com/i/a{b}.png\');\r\n        }\r\n      }',
  ].join('\r\n');

  it('стили, протёкшие в начало текста письма, вырезаются; само письмо остаётся', () => {
    const out = mailBodyToText(`${LEAKED_CSS}\r\n\r\nДобрый день!\r\nВстреча в 13:00 { не стиль }\r\n`);
    expect(out).toBe('Добрый день!\nВстреча в 13:00 { не стиль }');
  });

  // Потеря текста письма хуже остатка стилей: вырезаем, только когда в начале подряд
  // стоят хотя бы два настоящих правила CSS. Примеры ниже — из независимой проверки.
  it('письмо, которое не начинается со стилей, не трогается — даже с фигурными скобками', () => {
    for (const text of [
      'Привет!\n.card { color: red; }\nэто пример из вёрстки',
      '{"status": "ok", "items": [1, 2]}',
      'Смотри конфиг:\nserver { listen: 80; }',
      'Hello team, see the rule below\n\n.card { color: red; }',
      'function f() { return 1; }',
      'Итог: {пусто}',
      'Hi John,\nplease fix {a: b}\nThanks',
      'Meeting at 13:00 { note: bring laptop }\nSee you there',
      'Hello team {}\nrest of the letter',
      'Response: {"status": "ok", "items": [1, 2]}\nПосмотри, пожалуйста',
      'const x = { a: 1 };\nостальное письмо',
      "data = {'a': 1, 'b': 2}\nостальное",
      'location / { root: /var/www; }\nтекст',
      'switch (x) { default: return; }\nтекст',
      'query { user: me }\nтекст',
      ':-) hi { a: b } more',
      'Hello team, see the rule: .card { color: red; } it is wrong',
      'OK {x:1}',
      '@ivan посмотри отчёт; спасибо\nвторая строка',
      '@channel please review the doc; thanks\nsecond line',
      '/* заметка */ Привет, это письмо',
      // Одно правило — ещё не доказательство, что это стили, а не текст автора.
      '.card { color: red; }\nтак выглядит правило',
      'I code { a: b } and more { c: d } text',
      // Слова с заглавной буквы — не теги: так браузер печатает объекты в консоли.
      'Object { id: 1 }\nObject { id: 2 }\nлог консоли',
      'Table { rows: 10 }\nForm { fields: 3 }\nPlease review.',
      'Summary {\nstatus: done\n}\nDetails {\nowner: Ivan\n}\nThanks',
      'Button { text: "OK" }\nLabel { text: "Name" }\nэто QML',
      'I { love: you }\nU { too: yes }\nподпись',
      // Слова с дефисом и куски конфигов.
      'smtp-server { host: mail.example.com; port: 587 }\nimap-server { host: mail.example.com; port: 993 }\nВот настройки почты',
      'Follow-up { date: Monday }\nCheck-in { time: 10:00 }\nRegards',
      // Селекторы без тега, которые стилями не являются.
      '#1 { done: yes }\n#2 { done: no }\nстатус задач',
      '.env { KEY: value }\n.gitignore { node_modules: yes }\nфайлы',
      '[section] { a: b }\n[other] { c: d }',
      '.NET { version: 8 }\n.NET { version: 9 }',
      ':D {a: b} :P {c: d} lol',
      'Caption { ru: Привет }\nLabel { ru: Имя }',
      // Похоже на стили по форме, но свойства — не из CSS.
      'table { rows: 10 }\nform { fields: 3 }\nтекст',
    ]) {
      expect(mailBodyToText(text), text).toBe(text);
    }
  });

  it('стили почтовых клиентов вырезаются целиком: @import с «;» в адресе, правила Outlook, старые приёмы IE', () => {
    const css = [
      "@import url('https://fonts.example.com/css2?family=Roboto:wght@400;700&display=swap');",
      'body { margin: 0; }',
      'v\\:* { behavior: url(#default#VML); }',
      '.a { *zoom: 1; _height: 1px; }',
      'div[style*="margin: 16px 0;"] { margin: 0 !important; }',
      'u + #body a, #MessageViewBody a { color: inherit; }',
      '@font-face { font-family: "Roboto"; src: url(data:font/woff2;base64,AAAA) format("woff2"); }',
      '@keyframes spin { from { transform: rotate(0deg); } 50% { opacity: .5; } to { transform: rotate(360deg); } }',
      '.x:not(.a, .b):hover > td { color: red }',
      // Word: списки и «o\\:p»; старый Outlook пишет теги заглавными.
      '@list l0 { mso-list-id: 123; mso-list-template-ids: 456; }',
      '@list l0:level1 { mso-level-number-format: bullet; margin-left: 36pt; }',
      'o\\:p { margin: 0; }',
      'TABLE, TD { border-collapse: collapse; }',
      'title, style, script { display: none; }',
      ';',
      'p.MsoNormal, li.MsoNormal { margin: 0cm; font-size: 11pt; }',
    ].join('\n');
    expect(mailBodyToText(`${css}\n\nДобрый день`)).toBe('Добрый день');
  });

  it('разбор стилей останавливается на непонятном месте и ничего после него не трогает', () => {
    const text = 'body { margin: 0; }\ntd { padding: 0; }\nHello { not: css } world\np { color: red; }';
    expect(mailBodyToText(text)).toBe('Hello { not: css } world\np { color: red; }');
  });

  // Тело письма — чужие данные: время разбора должно расти линейно на любом входе.
  it('специально составленное письмо разбирается быстро и без переполнения стека', () => {
    const n = 200_000;
    const hostile = [
      `a{${"'\n".repeat(n)}}`,
      `a{${'"\n'.repeat(n)}}`,
      `a{${'url(\n'.repeat(n)}}`,
      `a{${"'\n".repeat(n)}`,
      `a{a:${' '.repeat(n)};!}`,
      `${'a{'.repeat(n)}${'}'.repeat(n)}`,
      `${'@media x{'.repeat(n)}${'}'.repeat(n)}`,
      'a{'.repeat(n),
      `body{margin:0}td{padding:0}${'/*'.repeat(n)}`,
      `@${'a'.repeat(n)}`,
      `@import ${'x'.repeat(n)}`,
      `${'body{margin:0}'.repeat(n / 10)}`,
      `body{margin:0}td{padding:0}a[x="${'y'.repeat(n)}`,
      `Привет${ZWNJ.repeat(n)}x`,
      `Привет${(ZWNJ + ZWJ).repeat(n / 2)}`,
      '<a '.repeat(n / 3),
      '2 <a '.repeat(n / 5),
      'если a <b и b <i то '.repeat(n / 20),
      `${'<div>'.repeat(n / 5)}глубоко`,
      `${'<div><p>'.repeat(n / 8)}глубоко${'</p></div>'.repeat(n / 8)}`,
    ];
    for (const text of hostile) {
      const started = performance.now();
      expect(() => mailBodyToText(text), text.slice(0, 24)).not.toThrow();
      expect(performance.now() - started, text.slice(0, 24)).toBeLessThan(1_500);
    }
  });

  it('письмо с тегами чрезмерной вложенности всё равно отдаёт текст', () => {
    expect(mailBodyToText(`${'<div>'.repeat(5_000)}Важный текст &amp; подпись${'</div>'.repeat(5_000)}`)).toBe('Важный текст & подпись');
  });

  it('mailBody сообщает, сколько знаков стилей убрано из начала письма', () => {
    expect(mailBody('body { margin: 0; }\ntd { padding: 0; }\nПривет')).toEqual({ text: 'Привет', strippedStyleChars: 39 });
    expect(mailBody('Привет')).toEqual({ text: 'Привет', strippedStyleChars: 0 });
  });

  it('в тексте письма раскодируются сущности, оставленные Битриксом', () => {
    expect(mailBodyToText('Тема &quot;Отчёт&quot; &amp; план&nbsp;на &#39;завтра&#39; &lt;срочно&gt;')).toBe('Тема "Отчёт" & план на \'завтра\' <срочно>');
    expect(mailBodyToText('Счёт &#8470;5 на 100&nbsp;&#8381; &mdash; оплатить до пятницы &#x2014; AT&T')).toBe('Счёт №5 на 100 ₽ — оплатить до пятницы — AT&T');
  });

  it('адреса с «сырым» & не портятся: раскодируются только сущности с точкой с запятой', () => {
    const url = 'https://shop.example.com/track?order=5&region=77&timestamp=170000&copy=1&section=2&param=x&currency=RUB&notify=1&lt=3';
    expect(mailBodyToText(url)).toBe(url);
  });

  it('составные эмодзи и слова с невидимым соединителем внутри не разбиваются', () => {
    expect(mailBodyToText('Семья 👨\u200D👩\u200D👧 и флаг 🏳️\u200D🌈, می\u200Cخواهم')).toBe('Семья 👨\u200D👩\u200D👧 и флаг 🏳️\u200D🌈, می\u200Cخواهم');
    // А набивка предзаголовка рассылки из одних невидимых знаков и пробелов исчезает.
    expect(mailBodyToText('Акция\u200C \u200C \u200C\u00A0\u200D \u200C\nТекст')).toBe('Акция\nТекст');
  });

  // В письмах-рассылках после снятия тегов до 95 % текста — пустые строки и отступы
  // (проверено на портале): без чистки настоящее содержимое не помещается в обрезку.
  it('пустые строки, отступы и невидимые символы от вёрстки сжимаются', () => {
    const raw = ' \n          \n        \n      Заголовок\n\t\n\t\n\n\n\n \n\n\t\t\t Абзац   с    отступами \u200b\u200c\ufeff\n\n\n\nПодпись\u00a0автора   \n   \n';
    expect(mailBodyToText(raw)).toBe('Заголовок\n\nАбзац с отступами\n\nПодпись автора');
  });

  it('переводы строк Windows приводятся к обычным', () => {
    expect(mailBodyToText('строка 1\r\nстрока 2')).toBe('строка 1\nстрока 2');
  });

  // fc.string() даёт только короткий ASCII — собираем текст из кусков, где есть кириллица,
  // эмодзи, длинные пробельные участки и невидимые знаки.
  const piece = fc.oneof(
    fc.string({ unit: 'grapheme' }),
    fc.constantFrom('Привет', 'мир', 'Hello', '👨' + ZWJ + '👩', 'می' + ZWNJ + 'خواهم', '№5', 'a:b;', '}', ';', '@', '/*', '*/', 'url(', '"', "'"),
    fc.constantFrom(' ', '  ', '\t', '\n', '\n\n\n\n', '\r\n', ' \n \n ', NBSP, ZWSP, ZWNJ, ZWJ, BOM, ZWNJ + ' ' + ZWNJ),
  );
  const plainText = fc
    .array(piece, { maxLength: 40 })
    .map((parts) => parts.join(''))
    .filter((x) => !x.includes('{') && !x.includes('&') && !looksLikeHtml(x));
  const visible = (text: string) => Array.from(text).filter((ch) => !/\s/.test(ch) && ![ZWSP, ZWNJ, ZWJ, WORD_JOINER, SOFT_HYPHEN, CGJ].includes(ch)).join('');

  it('property: чистка не теряет ни одного видимого знака письма и повторная чистка ничего не меняет', () => {
    fc.assert(
      fc.property(plainText, (text) => {
        const out = mailBodyToText(text);
        expect(visible(out)).toBe(visible(text));
        expect(mailBodyToText(out)).toBe(out);
      }),
    );
  });
});
