import { describe, expect, it } from 'vitest';
import { status } from './status.js';
import { fakeContext } from './testkit.js';

const noUpdate = async () => ({ currentVersion: '0.1.0', latestVersion: null, updateAvailable: false });
const deps = { check: noUpdate, envFileMode: () => 0o600 };
const me = () => ({ json: { result: { ID: '1', NAME: 'Иван' } } });

describe('status', () => {
  it('показывает недостающие и лишние права по разделам, без кода вебхука', async () => {
    const { ctx } = fakeContext({
      scope: () => ({ json: { result: ['im', 'task', 'crm', 'user_basic'] } }),
      'user.current': () => ({ json: { result: { ID: '1', NAME: 'Иван', LAST_NAME: 'Петров', TIME_ZONE: 'Europe/Moscow' } } }),
    });
    const out = await status(ctx, deps);
    const data = out.data as { portal: string; user: unknown; scopes: { extra: string[] }; sections: Record<string, string> };
    expect(data.portal).toBe('example.bitrix24.ru');
    expect(data.user).toEqual({ id: 1, name: 'Иван Петров' });
    expect(data.scopes.extra).toEqual(['crm']);
    expect(data.sections.chats).toBe('ok');
    expect(data.sections.disk).toBe('нет права disk');
    expect(data.sections.mail).toBe('нет права mail');
    expect(data.sections.projects).toBe('нет права sonet_group, socialnetwork');
    expect(JSON.stringify(out)).not.toContain('testsecret0000');
  });

  it('право user шире нужного — помечено лишним, раздел сотрудников работает', async () => {
    const { ctx } = fakeContext({
      scope: () => ({ json: { result: ['im', 'user'] } }),
      'user.current': () => ({ json: { result: { ID: '1', NAME: 'Иван' } } }),
    });
    const data = (await status(ctx, deps)).data as { scopes: { extra: string[] }; sections: Record<string, string> };
    expect(data.sections.users).toBe('ok');
    expect(data.scopes.extra).toEqual(['user']);
  });

  it('ключ не принят — APP_B24_AUTH_FAILED', async () => {
    const { ctx } = fakeContext({ scope: () => ({ status: 401, json: { error: 'INVALID_CREDENTIALS', error_description: 'x' } }) });
    await expect(status(ctx, deps)).rejects.toMatchObject({ code: 'APP_B24_AUTH_FAILED' });
  });

  it('Битрикс вернул права или владельца в неожиданном виде — APP_B24_UNEXPECTED_RESPONSE, а не «нет прав»', async () => {
    const noScopes = fakeContext({ scope: () => ({ json: { result: null } }), 'user.current': me });
    await expect(status(noScopes.ctx, deps)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
    const noUser = fakeContext({ scope: () => ({ json: { result: ['im'] } }), 'user.current': () => ({ json: { result: null } }) });
    await expect(status(noUser.ctx, deps)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('файл с вебхуком открыт другим пользователям машины — пометка с командой chmod', async () => {
    const open = fakeContext({ scope: () => ({ json: { result: ['im'] } }), 'user.current': me });
    expect((await status(open.ctx, { check: noUpdate, envFileMode: () => 0o644 })).notes.join(' ')).toContain('chmod 600');
    const closed = fakeContext({ scope: () => ({ json: { result: ['im'] } }), 'user.current': me });
    expect((await status(closed.ctx, deps)).notes.join(' ')).not.toContain('chmod');
    // Файла нет (адрес задан переменной окружения) — проверять нечего.
    const absent = fakeContext({ scope: () => ({ json: { result: ['im'] } }), 'user.current': me });
    expect((await status(absent.ctx, { check: noUpdate, envFileMode: () => null })).notes.join(' ')).not.toContain('chmod');
  });
});
