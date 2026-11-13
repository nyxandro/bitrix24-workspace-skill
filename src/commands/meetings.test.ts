import { describe, expect, it } from 'vitest';
import { meetingsGet, meetingsList } from './meetings.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const call = (id: number, participants: number[]) => ({
  callId: id,
  startDate: '2026-11-10T10:00:00+03:00',
  endDate: '2026-11-10T11:00:00+03:00',
  durationSeconds: 3600,
  chatId: 55,
  participants: participants.map((u) => ({ userId: u, name: `Сотрудник ${u}`, talkedSeconds: 100 })),
  tracks: [{ url: 'https://x/rec?token=1', relUrl: '/rec' }],
  overview: { topic: 'Планёрка', agreements: ['Сдать отчёт'], actionItems: [{ text: 'Иван: отчёт к пятнице' }], agenda: 'Повестка' },
  summary: { segments: [{ title: 'Начало', summary: 'Обсудили' }] },
  transcription: { segments: [{ userId: 1, userName: 'Я', text: 'Привет' }] },
});

describe('meetings', () => {
  it('list — обязательны --from/--to, всегда только где я участник, курсор-объект', async () => {
    const { ctx, calls } = fakeContext({
      'call.followup.list': () => ({ json: { result: { items: [call(9, [1, 2])], hasMore: true, afterCursor: { startDate: 'x', callId: 9 } } } }),
    });
    await expect(meetingsList(ctx, { to: '2026-11-30' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const out = await meetingsList(ctx, { from: '2026-11-01', to: '2026-11-30' });
    expect(calls[0]?.body).toMatchObject({ filter: { participantId: 1, startDate: { from: '2026-11-01T00:00:00+03:00', to: '2026-11-30T23:59:59+03:00' } }, pagination: { limit: 20 } });
    expect((out.data as M[])[0]).toEqual({ callId: 9, start: '2026-11-10T10:00:00+03:00', end: '2026-11-10T11:00:00+03:00', durationSeconds: 3600, topic: 'Планёрка', participants: [{ id: 1, name: 'Сотрудник 1' }, { id: 2, name: 'Сотрудник 2' }] });
    await meetingsList(ctx, { from: '2026-11-01', to: '2026-11-30', page: String(out.next) });
    expect(calls[1]?.body).toMatchObject({ pagination: { afterCursor: { startDate: 'x', callId: 9 } } });
    expect(JSON.stringify(out)).not.toMatch(/token|relUrl/);
  });

  it('get — итог без расшифровки; с --transcript — с ней; чужая встреча — отказ без данных', async () => {
    const { ctx } = fakeContext({ 'call.followup.get': [() => ({ json: { result: { item: call(9, [1, 2]) } } }), () => ({ json: { result: { item: call(9, [1, 2]) } } }), () => ({ json: { result: { item: call(10, [2, 3]) } } })] });
    const plain = (await meetingsGet(ctx, '9', {})).data as M;
    expect(plain).toMatchObject({ topic: 'Планёрка', agreements: ['Сдать отчёт'], agenda: 'Повестка' });
    expect(plain).not.toHaveProperty('transcript');
    expect(JSON.stringify(plain)).not.toMatch(/token|relUrl|url/);
    const withT = (await meetingsGet(ctx, '9', { transcript: true })).data as M;
    expect(withT.transcript).toEqual([{ speaker: 'Я', text: 'Привет' }]);
    await expect(meetingsGet(ctx, '10', {})).rejects.toMatchObject({ code: 'APP_B24_ACCESS_DENIED' });
  });
});
