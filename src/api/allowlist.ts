/**
 * Список методов Битрикс24, которые скилл вправе вызывать. Только чтение.
 *
 * Это единственная граница «только чтение»: у вебхука нет такого режима, ключ
 * сам по себе позволяет запись. Добавлять метод — только после проверки по
 * документации, что у него нет побочных эффектов (например,
 * disk.file.getExternalLink похож на чтение, а создаёт публичную ссылку).
 */

export const ALLOWED_V1: ReadonlySet<string> = new Set([
  'scope',
  'user.current',
  'user.get',
  'user.search',
  'im.recent.list',
  'im.counters.get',
  'im.search.chat.list',
  'im.dialog.get',
  'im.dialog.users.list',
  'im.dialog.messages.get',
  'im.dialog.messages.search',
  'im.notify.get',
  'im.department.get',
  'im.department.managers.get',
  'im.department.employees.get',
  'im.department.colleagues.list',
  'im.search.department.list',
  'socialnetwork.api.workgroup.list',
  'socialnetwork.api.workgroup.get',
  'sonet_group.user.groups',
  'sonet_group.user.get',
  'tasks.task.list',
  'tasks.task.get',
  'task.checklistitem.getlist',
  'disk.storage.getlist',
  'disk.storage.getchildren',
  'disk.folder.getchildren',
  'disk.file.get',
  'disk.file.search',
  'calendar.event.get',
  'calendar.event.getbyid',
  'log.blogpost.get',
  'log.blogcomment.get',
  'timeman.status',
]);

// Методы, которые есть только в REST 3.0 (адрес /rest/api/…).
export const ALLOWED_V3: ReadonlySet<string> = new Set([
  'mail.mailbox.list',
  'mail.message.list',
  'mail.message.get',
  'mail.message.thread',
  'call.followup.list',
  'call.followup.get',
  'note.collection.list',
  'note.document.search.list',
  'note.document.tree.list',
  'note.document.get',
  'timeman.record.list',
]);

export const FORBIDDEN_WORDS: ReadonlySet<string> = new Set([
  'add',
  'update',
  'delete',
  'set',
  'send',
  'read',
  'unread',
  'mark',
  'move',
  'copy',
  'rename',
  'upload',
  'commit',
  'share',
  'external',
  'hide',
  'pin',
  'mute',
  'leave',
  'like',
  'answer',
  'confirm',
  'create',
  'start',
  'complete',
  'approve',
  'delegate',
  'restore',
  'forward',
  'reply',
  'open',
  'close',
  'pause',
  'remove',
  'defer',
  'renew',
  'stop',
  'attach',
  'archive',
  'invite',
  'join',
  'bind',
  'register',
  'save',
  'command',
  'writing',
  'terminate',
  'favorite',
]);

// Последнее слово разрешённого метода — только из этого набора. Это главная
// страховка: пишущие методы Битрикса заканчиваются глаголом действия (add,
// notify, writing, save…), а не get/list.
export const READ_LAST_WORDS: ReadonlySet<string> = new Set([
  'get',
  'list',
  'search',
  'getlist',
  'getchildren',
  'getbyid',
  'thread',
  'current',
  'status',
  'groups',
  'scope',
]);

// Слова имени метода: по точкам, подчёркиваниям и границам camelCase.
export function splitMethodWords(method: string): string[] {
  return method
    .split(/[._]/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])/))
    .map((word) => word.toLowerCase())
    .filter((word) => word !== '');
}

// Битрикс часто пишет методы слитно строчными (uploadfile, addsubfolder,
// getexternallink), поэтому слово проверяется по началу — и после «get», «un»,
// «dis» (unmute, disapprove). По началу, а не по вхождению: «thread» не должен
// совпасть с «read».
function isForbiddenWord(word: string): boolean {
  const stems = [word];
  for (const prefix of ['get', 'un', 'dis']) {
    if (word.startsWith(prefix)) {
      stems.push(word.slice(prefix.length));
    }
  }
  return stems.some((stem) => [...FORBIDDEN_WORDS].some((verb) => stem.startsWith(verb)));
}

export function isForbiddenName(method: string): boolean {
  return splitMethodWords(method).some(isForbiddenWord);
}

// Форма метода «только чтение»: последнее слово читающее и нигде нет глагола записи.
export function isReadOnlyShape(method: string): boolean {
  const words = splitMethodWords(method);
  const last = words[words.length - 1];
  return last !== undefined && READ_LAST_WORDS.has(last) && !isForbiddenName(method);
}

// Право вебхука, нужное методу. Точные названия прав на портале проверяются
// вызовом `scope` (шаг 0 спецификации, V9).
const SCOPE_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['scope', 'basic'],
  ['user.', 'user_basic'],
  ['im.', 'im'],
  // socialnetwork.api.* требует отдельного права socialnetwork, а не sonet_group (проверено на портале).
  ['socialnetwork.', 'socialnetwork'],
  ['sonet_group.', 'sonet_group'],
  ['tasks.', 'task'],
  ['task.', 'task'],
  ['disk.', 'disk'],
  ['calendar.', 'calendar'],
  ['log.', 'log'],
  ['timeman.', 'timeman'],
  ['mail.', 'mail'],
  ['call.', 'call'],
  ['note.', 'note'],
];

export const SCOPE_SECTIONS: Readonly<Record<string, string>> = {
  basic: 'основа',
  user_basic: 'сотрудники',
  im: 'чаты, уведомления и оргструктура',
  sonet_group: 'проекты (участники)',
  socialnetwork: 'проекты (список и карточка)',
  task: 'задачи',
  disk: 'диск',
  calendar: 'календарь',
  log: 'живая лента',
  timeman: 'рабочее время',
  mail: 'почта',
  call: 'итоги встреч',
  note: 'база знаний',
};

export function scopeForMethod(method: string): string | undefined {
  const hit = SCOPE_BY_PREFIX.find(([prefix]) => (prefix.endsWith('.') ? method.startsWith(prefix) : method === prefix));
  return hit?.[1];
}
