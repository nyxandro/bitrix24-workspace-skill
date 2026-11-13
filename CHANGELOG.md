# Changelog

Все значимые изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [семантического версионирования](https://semver.org/lang/ru/).

## [0.1.0] — 2026-11-13

Первая версия: чтение рабочего Битрикс24 через входящий вебхук, только чтение.

### Добавлено
- `status` — проверка подключения, доступность разделов, лишние права, новая версия скилла.
- Чаты: `chats recent|counters|find|info|messages|search`, `notifications`.
- Задачи и проекты: `tasks list|get` (по всем ролям владельца вебхука), `projects list|get`.
- Диск: `disk storages|ls|search|file|download`.
- Почта: `mail boxes|list|get|thread`.
- Календарь и встречи: `calendar upcoming|events|event`, `meetings list|get` (ИИ-итоги).
- Лента и база знаний: `feed list|post`, `kb list|search|tree|doc`.
- Структура и время: `users find|get`, `org me|find|department`, `worktime status|records`.
- Безопасность: список разрешённых методов только для чтения с проверкой формы имени метода;
  ключи вебхука и ссылок на скачивание не выводятся; финальная проверка вывода.
- Установщик `install.sh`, архив `bitrix24-workspace.skill`, инструкция агенту `SKILL.md`.
