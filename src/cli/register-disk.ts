/**
 * Команды disk.
 */
import type { Command } from 'commander';
import { diskDownload, diskFile, diskLs, diskSearch, diskStorages } from '../commands/disk.js';
import type { Runner } from './runtime.js';

export function registerDisk(program: Command, run: Runner): void {
  const disk = program.command('disk').description('Файлы на Диске');
  disk
    .command('storages')
    .description('Где искать файлы: мой диск, общий, диски моих групп')
    .option('--all', 'все хранилища, которые мне видны')
    .option('--page <курсор>', 'значение next (с --all)')
    .action((opts: { all?: boolean; page?: string }) => run((ctx) => diskStorages(ctx, opts)));
  disk
    .command('ls')
    .description('Содержимое хранилища или папки')
    .argument('<папка>', 'storage:<номер> или folder:<номер>')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((target: string, opts: { page?: string }) => run((ctx) => diskLs(ctx, target, opts)));
  disk
    .command('search')
    .description('Найти файл по названию и тексту документа (файлы чатов не охватывает)')
    .argument('<текст>', 'не меньше 3 символов')
    .option('--storage <id>', 'только в хранилище')
    .option('--folder <id>', 'только в папке')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((text: string, opts: { storage?: string; folder?: string; limit?: string; page?: string }) =>
      run((ctx) => diskSearch(ctx, text, opts)),
    );
  disk
    .command('file')
    .description('Сведения о файле, в том числе о вложении из чата (fileId)')
    .argument('<id>', 'номер файла')
    .action((id: string) => run((ctx) => diskFile(ctx, id)));
  disk
    .command('download')
    .description('Скачать файл в папку, чтобы прочитать его')
    .argument('<id>', 'номер файла')
    .option('--out <папка>', 'куда сохранить (обязательно)')
    .option('--max-mb <n>', 'предел размера (по умолчанию 100, максимум 1024)')
    .action((id: string, opts: { out?: string; maxMb?: string }) => run((ctx) => diskDownload(ctx, id, opts)));
}
