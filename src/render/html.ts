/**
 * Тело письма → текст. Формат тела в REST не описан: HTML переводим в текст; текст
 * без тегов чистим от того, что оставляет Битрикс после снятия разметки, — стилей в
 * начале, сущностей, пустых строк и отступов вёрстки.
 */
import { decodeHTMLStrict } from 'entities';
import { convert } from 'html-to-text';

const HTML_TAG_RE = /<\/?(?:html|head|body|div|p|br|table|tbody|thead|tr|td|th|span|a|font|ul|ol|li|h[1-6]|blockquote|img|strong|b|i|u|em|style|meta|center|hr)\b[^<>]*>/i;

// Поиск «>» останавливается на следующей «<»: иначе текст с тысячами «<a » без «>»
// (чужое письмо) заставлял бы каждый раз просматривать его до конца.
export function looksLikeHtml(body: string): boolean {
  return HTML_TAG_RE.test(body);
}

// Библиотека обходит дерево тегов рекурсивно и на тысячах вложенных тегов падает
// с переполнением стека. Настоящие письма вложены на десятки уровней; глубже —
// снимаем теги без построения дерева.
const MAX_HTML_DEPTH = 300;
const ANY_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>/g;
const VOID_TAGS = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'wbr', 'area', 'base', 'source']);

function isTooDeep(html: string): boolean {
  let depth = 0;
  for (const tag of html.matchAll(ANY_TAG_RE)) {
    if (VOID_TAGS.has((tag[2] as string).toLowerCase())) continue;
    depth += tag[1] === '/' ? -1 : 1;
    if (depth > MAX_HTML_DEPTH) return true;
    if (depth < 0) depth = 0;
  }
  return false;
}

export function htmlToText(html: string): string {
  if (isTooDeep(html)) {
    return tidyPlainText(decodeHTMLStrict(html.replace(ANY_TAG_RE, '\n')));
  }
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      // По умолчанию таблица — просто блок, и суммы слипаются с подписями.
      { selector: 'table', format: 'dataTable' },
    ],
  }).trim();
}

// Битрикс отдаёт тело письма уже без тегов, но содержимое блока <style> оставляет
// текстом в начале (проверено на живом портале). Вырезаем только начало, которое
// разбирается как стили, и только если правил подряд не меньше двух: потерять текст
// письма хуже, чем оставить в нём обрывок стилей.
//
// Тело письма — чужие данные, поэтому разбор идёт одним проходом вперёд без возвратов
// и без рекурсии: на любом входе время растёт линейно. Первая же непонятная
// конструкция останавливает разбор, всё после неё остаётся в тексте как есть.
const MIN_RULES_TO_STRIP = 2;
const MAX_PRELUDE_CHARS = 400;
const MAX_AT_STATEMENT_CHARS = 1000;
const MAX_AT_DEPTH = 6;
const AT_STATEMENT_RE = /@(?:import|charset|namespace)\b/iy;
const RULES_AT_BLOCK_RE = /@(?:-[a-z]+-)?(?:media|supports|keyframes|document|layer|container)\b/iy;
// «@list l0:level1 { mso-level-… }» — так Word описывает списки.
const DECLARATIONS_AT_BLOCK_RE = /@(?:-[a-z]+-)?(?:font-face|page|viewport|list)\b/iy;
// «*zoom» и «_height» — старые приёмы для Internet Explorer, в письмах встречаются.
const PROPERTY_RE = /[*_]?-{0,2}[a-zA-Z][\w-]*/y;
const COMPOUND_RE = /^(\*|[a-zA-Z][a-zA-Z0-9]*)?(?:[.#]-?[_a-zA-Z][\w-]*|\[\]|::?-?[a-z][\w-]*(?:\(\))?)*$/;
const KEYFRAME_STEP_RE = /^(?:from|to|\d+(?:\.\d+)?%)$/i;
// Форма «слово { слово: значение }» бывает и в конфигах, и в выводе консоли. Стили
// отличает то, что свойства — из CSS: требуем хотя бы два таких объявления.
const MIN_CSS_PROPERTIES_TO_STRIP = 2;
const VENDOR_PROPERTY_RE = /^[*_]?(?:-(?:webkit|moz|ms|o)-|mso-)/;
const CSS_PROPERTY_HEADS = new Set(
  (
    'color background border margin padding font line text display width height max min float clear position ' +
    'top left right bottom overflow vertical white word letter opacity visibility z list table outline cursor ' +
    'content direction box src size transform transition animation filter behavior zoom unicode panose tab ' +
    'layout page'
  ).split(' '),
);

function isCssProperty(name: string): boolean {
  if (VENDOR_PROPERTY_RE.test(name)) return true;
  const head = name.replace(/^[*_]/, '').toLowerCase().split('-')[0] as string;
  return CSS_PROPERTY_HEADS.has(head);
}
const VML_SELECTOR_RE = /^[a-z]\\:(?:\*|[a-z]+)$/i; // «v\:*», «o\:p» — правила Outlook и Word
// Голое слово в селекторе должно быть тегом HTML: иначе «Hi John, please fix {a: b}»
// выглядело бы правилом.
const HTML_TAGS = new Set(
  (
    'html head body div span p a img table tbody thead tfoot tr td th caption col colgroup ul ol li dl dt dd ' +
    'h1 h2 h3 h4 h5 h6 b i u s strong em small big sub sup blockquote pre code center font hr br button input ' +
    'select option optgroup textarea label form fieldset legend section article header footer nav main aside ' +
    'figure figcaption video audio iframe svg picture source abbr address cite q mark del ins time strike tt ' +
    'nobr wbr kbd samp var details summary object embed map area canvas title style script link path g'
  ).split(' '),
);

function isBlank(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f';
}

// Позиция после пробелов и комментариев; -1 — комментарий не закрыт.
function skipBlank(text: string, from: number): number {
  let i = from;
  for (;;) {
    while (isBlank(text[i])) i += 1;
    if (!text.startsWith('/*', i)) return i;
    const close = text.indexOf('*/', i + 2);
    if (close === -1) return -1;
    i = close + 2;
  }
}

// Индекс закрывающей кавычки; -1 — строка не закрыта до конца своей строки текста.
function quoteEnd(text: string, open: number): number {
  const quote = text[open];
  for (let i = open + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === quote) return i;
    if (ch === '\n') return -1;
    if (ch === '\\') i += 1;
  }
  return -1;
}

// Индекс «)» у url(…); внутри допускаются кавычки, «;» и фигурные скобки.
function urlEnd(text: string, open: number): number {
  for (let i = open + 4; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ')') return i;
    if (ch === '\n') return -1;
    if (ch === '"' || ch === "'") {
      i = quoteEnd(text, i);
      if (i === -1) return -1;
    }
  }
  return -1;
}

// Конец куска: индекс первого из знаков stops (at) и было ли в куске содержимое (seen).
// Кавычки, url(…) и комментарии пропускаются целиком. at = -1 — кусок длиннее limit,
// оборван или в нём встретилась фигурная скобка.
function scanTo(text: string, from: number, stops: string, limit: number): { at: number; seen: boolean } {
  let seen = false;
  const last = Math.min(text.length, from + limit);
  for (let i = from; i < last; i += 1) {
    const ch = text[i] as string;
    if (stops.includes(ch)) return { at: i, seen };
    if (ch === '{' || ch === '}') break;
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    if (isBlank(ch)) continue;
    seen = true;
    if (ch === '"' || ch === "'") {
      i = quoteEnd(text, i);
    } else if (ch === 'u' && text.startsWith('url(', i)) {
      i = urlEnd(text, i);
    }
    if (i === -1) break;
  }
  return { at: -1, seen };
}

// Блок объявлений «свойство: значение;» с позиции после «{»: индекс за «}» (end = -1 —
// блок не разобран) и сколько в нём объявлений со свойствами CSS.
function declarationsEnd(text: string, from: number): { end: number; cssProperties: number } {
  let i = from;
  let cssProperties = 0;
  const failed = { end: -1, cssProperties: 0 };
  for (;;) {
    i = skipBlank(text, i);
    if (i === -1 || i >= text.length) return failed;
    if (text[i] === '}') return { end: i + 1, cssProperties };
    if (text[i] === ';') {
      i += 1;
      continue;
    }
    PROPERTY_RE.lastIndex = i;
    const property = PROPERTY_RE.exec(text);
    if (!property) return failed;
    i += property[0].length;
    while (isBlank(text[i])) i += 1;
    if (text[i] !== ':') return failed;
    const value = scanTo(text, i + 1, ';}', Infinity);
    if (value.at === -1 || !value.seen) return failed;
    if (isCssProperty(property[0])) cssProperties += 1;
    i = value.at;
  }
}

function isCompound(part: string, inBlock: boolean): boolean {
  if (VML_SELECTOR_RE.test(part) || (inBlock && KEYFRAME_STEP_RE.test(part))) return true;
  const match = COMPOUND_RE.exec(part);
  if (!match) return false;
  const tag = match[1];
  if (tag === undefined || tag === '*' || HTML_TAGS.has(tag)) return true;
  // Старый Outlook пишет теги заглавными («TABLE», «TD»). Слово с заглавной буквы
  // («Object», «Table») и одиночная заглавная («I», «U») — обычный текст.
  return tag.length > 1 && tag === tag.toUpperCase() && HTML_TAGS.has(tag.toLowerCase());
}

function isCssSelector(raw: string, inBlock: boolean): boolean {
  const prelude = raw.trim();
  // Перевод строки внутри селектора бывает только после запятой («table,\n td»).
  if (prelude === '' || /[^,\s]\s*\n/.test(prelude)) return false;
  // Содержимое [..] и (..) на вид селектора не влияет: в нём бывают пробелы и запятые.
  const flat = prelude
    .replace(/\[[^\]]*\]/g, '[]')
    .replace(/\([^()]*\)/g, '()')
    .replace(/\([^()]*\)/g, '()');
  return flat.split(',').every((selector) => {
    const parts = selector.split(/\s*[>+~]\s*|\s+/).filter((part) => part !== '');
    return parts.length > 0 && parts.every((part) => isCompound(part, inBlock));
  });
}

// Позиция, до которой текст с начала — стили; 0, если доказательств мало: правил меньше
// MIN_RULES_TO_STRIP или объявлений со свойствами CSS меньше MIN_CSS_PROPERTIES_TO_STRIP.
function leadingCssEnd(text: string): number {
  let i = 0;
  let depth = 0; // вложенность @media и подобных блоков
  let rules = 0;
  let cssProperties = 0;
  let end = 0;
  let endRules = 0;
  let endCssProperties = 0;
  const commit = () => {
    if (depth === 0) {
      end = i;
      endRules = rules;
      endCssProperties = cssProperties;
    }
  };
  for (;;) {
    i = skipBlank(text, i);
    if (i === -1 || i >= text.length) break;
    // Комментарии после разобранных правил — тоже стили.
    if (rules > 0) commit();
    const ch = text[i];
    // Лишняя «;» между правилами встречается в стилях Word.
    if (ch === ';' && rules > 0) {
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (depth === 0) break;
      depth -= 1;
      i += 1;
      rules += 1;
      commit();
      continue;
    }
    let declarationsFrom: number;
    if (ch === '@') {
      AT_STATEMENT_RE.lastIndex = i;
      RULES_AT_BLOCK_RE.lastIndex = i;
      DECLARATIONS_AT_BLOCK_RE.lastIndex = i;
      if (AT_STATEMENT_RE.test(text)) {
        const stop = scanTo(text, i, ';', MAX_AT_STATEMENT_CHARS).at;
        if (stop === -1) break;
        i = stop + 1;
        rules += 1;
        commit();
        continue;
      }
      const brace = scanTo(text, i, '{', MAX_PRELUDE_CHARS).at;
      if (brace === -1) break;
      if (RULES_AT_BLOCK_RE.test(text)) {
        if (depth >= MAX_AT_DEPTH) break;
        depth += 1;
        i = brace + 1;
        continue;
      }
      if (!DECLARATIONS_AT_BLOCK_RE.test(text)) break;
      declarationsFrom = brace + 1;
    } else {
      const brace = scanTo(text, i, '{', MAX_PRELUDE_CHARS).at;
      if (brace === -1 || !isCssSelector(text.slice(i, brace), depth > 0)) break;
      declarationsFrom = brace + 1;
    }
    const block = declarationsEnd(text, declarationsFrom);
    if (block.end === -1) break;
    i = block.end;
    rules += 1;
    cssProperties += block.cssProperties;
    commit();
  }
  return endRules >= MIN_RULES_TO_STRIP && endCssProperties >= MIN_CSS_PROPERTIES_TO_STRIP ? end : 0;
}

// Нулевой ширины, мягкий перенос и «склейка» — ими рассылки набивают невидимый
// предзаголовок. Перечислены через «|»: в одном классе символов объединяющие знаки
// читаются неоднозначно.
const INVISIBLE_RE = /\u200B|\u2060|\uFEFF|\u00AD|\u034F/g;
// Соединители U+200C/U+200D нужны внутри составных эмодзи и слов (фарси) — убираем
// только цепочки с краю: в начале или конце текста, перед пробелом или после него.
// Соседей проверяем в функции, а не в самом выражении: с условием «дальше пробел»
// длинная цепочка перед буквой перебиралась бы заново с каждой позиции.
const JOINER_RUN_RE = /(?:\u200C|\u200D)+/g;

function stripEdgeJoiners(text: string): string {
  return text.replace(JOINER_RUN_RE, (run: string, offset: number) => {
    const before = text[offset - 1];
    const after = text[offset + run.length];
    return before === undefined || after === undefined || /\s/.test(before) || /\s/.test(after) ? '' : run;
  });
}

// Текст письма после снятия тегов: вёрстка оставляет сотни пустых строк, отступы,
// неразрывные и невидимые символы. Сжимаем их, чтобы в ответ помещалось содержимое;
// отступы и выравнивание столбцов при этом не сохраняются.
function tidyPlainText(text: string): string {
  return stripEdgeJoiners(text.replace(/\r\n?/g, '\n').replace(/[\u00A0\u2007\u202F]/g, ' ').replace(INVISIBLE_RE, ''))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface MailBody {
  text: string;
  // Сколько знаков стилей убрано из начала письма: вызывающий сообщает об этом в пометке,
  // чтобы правка текста не была молчаливой.
  strippedStyleChars: number;
}

export function mailBody(body: string): MailBody {
  const strippedStyleChars = leadingCssEnd(body);
  const content = body.slice(strippedStyleChars);
  if (looksLikeHtml(content)) {
    return { text: htmlToText(content), strippedStyleChars };
  }
  // Теги Битрикс уже снял, а сущности («&quot;», «&#8470;») оставил — раскодируем.
  // Только сущности с «;»: иначе в адресе «…&copy=1&region=77» появились бы «©» и «®».
  return { text: tidyPlainText(decodeHTMLStrict(content)), strippedStyleChars };
}

export function mailBodyToText(body: string): string {
  return mailBody(body).text;
}
