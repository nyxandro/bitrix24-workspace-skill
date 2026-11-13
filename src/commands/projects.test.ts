import { describe, expect, it } from 'vitest';
import { projectsGet, projectsList } from './projects.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const wg = (id: number, type: string, name = `Группа ${id}`) => ({ id, name, type, numberOfMembers: 3, closed: 'N', dialogId: `chat${id + 1000}` });

describe('projects list', () => {
  it('поиск по названию, dialogId из ответа, sg<N> если его нет', async () => {
    const { ctx, calls } = fakeContext({
      'socialnetwork.api.workgroup.list': () => ({ json: { result: { workgroups: [wg(15, 'collab'), { ...wg(16, 'project'), dialogId: undefined }] }, total: 2 } }),
      'sonet_group.user.groups': () => ({ json: { result: [{ GROUP_ID: '15', ROLE: 'K' }] } }),
    });
    const out = await projectsList(ctx, { search: 'Икон' });
    expect(calls.find((c) => c.method === 'socialnetwork.api.workgroup.list')?.body).toMatchObject({ filter: { '%NAME': 'Икон' }, params: { shouldSelectDialogId: 'Y' }, start: 0 });
    expect(out.data).toEqual([
      { id: 15, name: 'Группа 15', type: 'collab', isMember: true, members: 3, dialogId: 'chat1015' },
      { id: 16, name: 'Группа 16', type: 'project', isMember: false, members: 3, dialogId: 'sg16' },
    ]);
  });

  it('--type collab листает страницы, пока не наберёт, — Битрикс по типу не фильтрует', async () => {
    const page = (start: number) => Array.from({ length: 50 }, (_, i) => wg(start + i + 1, start === 50 && i === 3 ? 'collab' : 'group'));
    const { ctx, calls } = fakeContext({
      'socialnetwork.api.workgroup.list': [
        () => ({ json: { result: { workgroups: page(0) }, next: 50, total: 120 } }),
        () => ({ json: { result: { workgroups: page(50) }, next: 100, total: 120 } }),
        () => ({ json: { result: { workgroups: [] }, total: 120 } }),
      ],
      'sonet_group.user.groups': () => ({ json: { result: [] } }),
    });
    const out = await projectsList(ctx, { type: 'collab', limit: '1' });
    expect((out.data as M[]).map((g) => g.id)).toEqual([54]);
    expect(calls.filter((c) => c.method === 'socialnetwork.api.workgroup.list').map((c) => c.body.start)).toEqual([0, 50]);
  });

  it('--type collab --limit 1: next продолжает с той же страницы после найденной, без повторов', async () => {
    const page = Array.from({ length: 50 }, (_, i) => wg(i + 1, i === 3 || i === 10 ? 'collab' : 'group'));
    const { ctx, calls } = fakeContext({
      'socialnetwork.api.workgroup.list': () => ({ json: { result: { workgroups: page }, total: 50 } }),
      'sonet_group.user.groups': () => ({ json: { result: [] } }),
    });
    const first = await projectsList(ctx, { type: 'collab', limit: '1' });
    expect((first.data as M[]).map((g) => g.id)).toEqual([4]);
    const second = await projectsList(ctx, { type: 'collab', limit: '1', page: String(first.next) });
    expect((second.data as M[]).map((g) => g.id)).toEqual([11]);
    expect(calls.filter((c) => c.method === 'socialnetwork.api.workgroup.list').every((c) => c.body.start === 0)).toBe(true);
  });

  it('--mine — только группы, где я участник', async () => {
    const { ctx, calls } = fakeContext({
      'sonet_group.user.groups': () => ({ json: { result: [{ GROUP_ID: '15' }, { GROUP_ID: '20' }] } }),
      'socialnetwork.api.workgroup.list': () => ({ json: { result: { workgroups: [wg(15, 'collab'), wg(20, 'group')] } } }),
    });
    const out = await projectsList(ctx, { mine: true });
    expect(calls.find((c) => c.method === 'socialnetwork.api.workgroup.list')?.body).toMatchObject({ filter: { ID: [15, 20] } });
    expect((out.data as M[]).every((g) => g.isMember === true)).toBe(true);
  });
});

describe('projects get', () => {
  it('Битрикс вернул пустоту вместо группы — APP_B24_NOT_FOUND, а не пустая карточка', async () => {
    for (const result of [null, [], {}]) {
      const { ctx } = fakeContext({ 'socialnetwork.api.workgroup.get': () => ({ json: { result } }) });
      await expect(projectsGet(ctx, '15')).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
    }
  });

  it('карточка и участники с именами, до 50', async () => {
    const members = Array.from({ length: 60 }, (_, i) => ({ USER_ID: String(i + 1), ROLE: i === 0 ? 'A' : 'K' }));
    const { ctx, calls } = fakeContext({
      'socialnetwork.api.workgroup.get': () => ({ json: { result: { ID: '15', NAME: 'Коллаба', DESCRIPTION: '[B]Описание[/B]', TYPE: 'collab', OWNER_ID: '1', NUMBER_OF_MEMBERS: '60' } } }),
      'sonet_group.user.get': () => ({ json: { result: members } }),
      'user.get': (b) => ({ json: { result: ((b.filter as M).ID as number[]).map((id) => ({ ID: String(id), NAME: `Имя${id}`, LAST_NAME: 'Ф' })) } }),
    });
    const out = await projectsGet(ctx, '15');
    const data = out.data as M;
    expect(calls[0]?.body).toEqual({ params: { groupId: 15 } });
    expect(data).toMatchObject({ id: 15, name: 'Коллаба', description: 'Описание', type: 'collab', dialogId: 'sg15', membersTotal: 60 });
    expect((data.members as M[]).length).toBe(50);
    expect((data.members as M[])[0]).toEqual({ id: 1, name: 'Имя1 Ф', role: 'владелец' });
  });
});
