const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, stubs = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    if (id in stubs) return stubs[id];
    throw Error(`Unexpected dependency ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const copy = load('src/lib/beta-tools.ts');
const permissions = load('src/lib/management-permissions.ts');
const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const ra = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
function actionHarness({ staff = false, grants = ['schedules', 'settings'] } = {}) {
  const calls = [];
  const profile = { id: me, account_kind: staff ? 'service_desk' : 'resident', role: 'resident', floor_number: staff ? null : 3 };
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'directory_profiles') return { data: [profile, { id: peer, role: 'resident', floor_number: 3 }, { id: ra, role: 'ra', floor_number: 3 }] };
      if (name === 'create_schedule_session') return { data: [{ share_token: 'created-token' }] };
      return { data: args?.p_slots?.length ?? 1 };
    },
    from(table) { return { update(values) { calls.push({ table, values }); return { eq: async () => ({ error: null }) }; } }; },
  };
  const actions = load('src/actions/beta-tools.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': { getCurrentProfile: async () => profile },
    '@/lib/management-access': { getManagementAccess: async () => ({ isRa: false, permissions: grants }), requireManagement: async key => { if (!grants.includes(key)) throw Error('denied'); return profile; } },
    '@/lib/management-permissions': permissions,
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/feature-flags': { getFeatureFlagState: async () => 'public' },
    '@/lib/beta-tools': copy,
    '@/lib/site-settings': { getSiteSettings: async () => ({ scheduleMaxDays: 31 }) },
  });
  return { actions, calls };
}
const validCreation = () => ({ kind: 'general', title: '日程確認', startDate: '2026-09-06', endDate: '2026-09-07', dailyStartTime: '09:00', dailyEndTime: '10:00', slotMinutes: 30, participantIds: [peer], raIds: [] });

test('schedule creation rejects impossible calendar dates, reversed ranges and sub-slot windows without writing', async () => {
  for (const override of [{ startDate: '2026-02-30', endDate: '2026-03-02' }, { startDate: '2026-02-29', endDate: '2026-03-01' }, { startDate: '2026-13-01' }, { startDate: '2026-09-08' }, { dailyEndTime: '09:15' }, { participantIds: null }, { kind: 'toString' }]) {
    const h = actionHarness();
    assert.ok((await h.actions.createScheduleSession({ ...validCreation(), ...override })).error);
    assert.equal(h.calls.length, 0, JSON.stringify(override));
  }
  const h = actionHarness();
  assert.equal((await h.actions.createScheduleSession({ ...validCreation(), startDate: '2028-02-29', endDate: '2028-03-01' })).success, true);
  assert.equal(h.calls.find(c => c.name === 'create_schedule_session').args.p_start_date, '2028-02-29');
});

test('availability validation preserves all-or-nothing semantics instead of silently truncating or dropping slots', async () => {
  const valid = { startAt: '2026-09-06T00:00:00+00:00', endAt: '2026-09-06T00:30:00.000Z' };
  for (const slots of [Array(1001).fill(valid), [valid, { startAt: 'invalid', endAt: valid.endAt }], [valid, null], [{ startAt: valid.startAt, endAt: '2026-09-06T00:00:00.000Z' }], [{ startAt: valid.endAt, endAt: valid.startAt }]]) {
    const h = actionHarness();
    assert.ok((await h.actions.saveScheduleAvailability(sessionId, slots)).error);
    assert.equal(h.calls.length, 0, 'Invalid payload must never replace existing availability');
  }
  for (const slots of [[], Array(1000).fill(valid)]) {
    const h = actionHarness();
    assert.equal((await h.actions.saveScheduleAvailability(sessionId, slots)).success, true);
    assert.strictEqual(h.calls[0].args.p_slots, slots, 'Valid payload is sent intact, including explicitly clearing all slots');
  }
});

test('schedule defaults reject NaN, infinite/fractional limits and insufficient time spans before a database update', async () => {
  for (const override of [NaN, Infinity, -Infinity, 3.5, 2, 32]) {
    const h = actionHarness();
    assert.ok((await h.actions.updateScheduleToolSettings({ startTime: '09:00', endTime: '10:00', slotMinutes: 30, maxDays: override })).error);
    assert.equal(h.calls.length, 0);
  }
  const h = actionHarness();
  assert.ok((await h.actions.updateScheduleToolSettings({ startTime: '09:00', endTime: '09:15', slotMinutes: 30, maxDays: 31 })).error);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.actions.updateScheduleToolSettings({ startTime: '09:00', endTime: '09:30', slotMinutes: 30, maxDays: 31 })).success, true);
  assert.equal(h.calls[0].values.schedule_max_days, 31);
});

test('delegated staff can select a real RA but cannot appoint themselves or submit NaN floors', async () => {
  for (const override of [{ raIds: [me] }, { floorNumber: NaN }]) {
    const h = actionHarness({ staff: true });
    assert.ok((await h.actions.createScheduleSession({ ...validCreation(), kind: 'lets_chat', participantIds: [], raIds: [ra], floorNumber: 3, ...override })).error);
    assert.ok(!h.calls.some(c => c.name === 'create_schedule_session'));
  }
  const h = actionHarness({ staff: true });
  assert.equal((await h.actions.createScheduleSession({ ...validCreation(), kind: 'lets_chat', participantIds: [], raIds: [ra], floorNumber: 3 })).success, true);
  assert.deepEqual(h.calls.find(c => c.name === 'create_schedule_session').args.p_ra_ids, [ra]);
});

// Render the real components into an element tree, retaining their callbacks. This
// tests saved-value/UI behavior without depending on a browser or TS source regexes.
function componentHarness(file, actions = {}) {
  const state = [], pending = [], errors = [];
  let index = 0;
  const ui = {};
  for (const [module, names] of Object.entries({
    '@/components/ui/button': ['Button'], '@/components/ui/checkbox': ['Checkbox'], '@/components/ui/input': ['Input'], '@/components/ui/label': ['Label'], '@/components/ui/select': ['Select'], '@/components/ui/textarea': ['Textarea'], '@/components/ui/date-range-picker': ['DateRangePicker'], '@/components/ui/pending-feedback': ['PendingFeedback'], '@/components/tools/beta-badge': ['BetaBadge'], '@/components/tools/share-link-button': ['ShareLinkButton'],
  })) ui[module] = Object.fromEntries(names.map(n => [n, n]));
  const component = load(file, {
    ...ui,
    '@/components/profile/avatar-ring': { AvatarRing: 'AvatarRing' },
    '@/lib/media-defaults': { DEFAULT_AVATAR_IMAGE_URL: '/avatar.svg' },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    react: { useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; }, useMemo: fn => fn() },
    'next/navigation': { useRouter: () => ({ refresh() {}, replace() {} }) }, 'next/image': { default: 'img' },
    'lucide-react': new Proxy({}, { get: (_, name) => name }), sonner: { toast: { error: msg => errors.push(msg), success() {} } },
    '@/actions/beta-tools': actions,
    '@/components/tools/use-schedule-operation': { useScheduleOperation: () => ({ pending: false, run: fn => { const task = Promise.resolve().then(fn); pending.push(task); return task; } }) },
    '@/lib/beta-tools': copy, '@/lib/constants': { FLOORS: [3, 4] }, '@/lib/utils': { cn: (...v) => v.join(' '), formatRoomNumber: () => '' },
  });
  return { errors, render(name, props) { index = 0; return component[name](props); }, settle: () => Promise.all(pending) };
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}
function textOf(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join('');
  return textOf(tree.props?.children);
}

test('persisted +00:00 availability stays selected, counts equivalent ISO slots together and survives save', async () => {
  let saved;
  const h = componentHarness('src/components/tools/schedule-room.tsx', { saveScheduleAvailability: async (id, slots) => { saved = { id, slots }; return { count: slots.length }; } });
  const props = {
    session: { id: sessionId, kind: 'general', title: '予定', status: 'open', start_date: '2026-09-06', end_date: '2026-09-06', daily_start_time: '09:00:00', daily_end_time: '10:00:00', slot_minutes: 30 },
    participants: [{ user_id: me, participant_role: 'participant' }, { user_id: peer, participant_role: 'participant' }],
    availability: [{ user_id: me, start_at: '2026-09-06T00:00:00+00:00' }, { user_id: peer, start_at: '2026-09-06T00:00:00.000Z' }],
    openLetsChatSlots: [], bookings: [], currentUserId: me, canManageBookings: false,
  };
  const tree = h.render('ScheduleRoom', props);
  const slots = nodes(tree).filter(n => n.type === 'button' && 'aria-pressed' in n.props);
  assert.equal(slots.length, 2);
  assert.equal(slots[0].props['aria-pressed'], true);
  assert.match(textOf(tree), /2\/2人/);
  nodes(tree).find(n => n.type === 'Button' && textOf(n).includes('選択した空き時間を保存')).props.onClick();
  await h.settle();
  assert.deepEqual(saved, { id: sessionId, slots: [{ startAt: '2026-09-06T00:00:00.000Z', endAt: '2026-09-06T00:30:00.000Z' }] });
});

test('the staff scheduling manager does not auto-select itself as a booking RA; actual same-floor RA does', async () => {
  for (const [role, floor, expectCreated] of [['resident', null, false], ['ra', 3, true], ['ra', 4, false]]) {
    const created = [];
    const h = componentHarness('src/components/tools/schedule-creator.tsx', { createScheduleSession: async input => { created.push(input); return { token: 'created' }; } });
    const props = { kind: 'lets_chat', profiles: [{ id: me, role, floor_number: floor }], currentUserId: me, currentFloor: 3, isRa: true };
    let tree = h.render('ScheduleCreator', props);
    nodes(tree).find(n => n.type === 'DateRangePicker').props.onChange('2026-09-06', '2026-09-07');
    tree = h.render('ScheduleCreator', props);
    nodes(tree).find(n => n.type === 'Button' && textOf(n).includes('日程調整ページを作成')).props.onClick();
    await h.settle();
    assert.equal(created.length, expectCreated ? 1 : 0);
    if (expectCreated) assert.deepEqual(created[0].raIds, [me]);
    else assert.match(h.errors.at(-1), /担当RA/);
  }
});


test('booking UI distinguishes eligible residents, assigned RAs and managers, including closed sessions', async () => {
  const requests = [];
  const base = {
    session: { id: sessionId, kind: 'lets_chat', title: '予約', status: 'open', floor_number: 3, start_date: '2026-09-06', end_date: '2026-09-06', daily_start_time: '09:00:00', daily_end_time: '10:00:00', slot_minutes: 30 },
    participants: [{ user_id: ra, participant_role: 'ra', full_name: '担当RA' }],
    availability: [], openLetsChatSlots: [{ ra_id: ra, start_at: '2026-09-06T00:00:00Z', end_at: '2026-09-06T00:30:00Z' }],
    bookings: [], currentUserId: me, canManageBookings: false, canBook: false,
  };
  for (const props of [
    { ...base, canManageBookings: true },
    { ...base, currentUserId: ra },
    { ...base, canBook: true, session: { ...base.session, status: 'closed' } },
  ]) {
    const h = componentHarness('src/components/tools/schedule-room.tsx');
    const tree = h.render('ScheduleRoom', props);
    assert.ok(!textOf(tree).includes('RAと時間を選んで予約'));
    assert.equal(nodes(tree).filter(n => n.type === 'button' && !('aria-pressed' in n.props)).length, 0);
    if (props.session.status === 'closed') assert.match(textOf(tree), /受付は終了/);
    if (props.currentUserId === ra) assert.match(textOf(tree), /空いている時間を選択/);
  }
  const h = componentHarness('src/components/tools/schedule-room.tsx', { bookLetsChatSlot: async (...args) => { requests.push(args); return { success: true }; } });
  const tree = h.render('ScheduleRoom', { ...base, canBook: true });
  const bookingButton = nodes(tree).find(n => n.type === 'button' && !('aria-pressed' in n.props));
  assert.ok(bookingButton, 'Eligible residents can choose a booking slot');
  const previousWindow = global.window;
  global.window = { confirm: () => true };
  try { bookingButton.props.onClick(); await h.settle(); }
  finally { if (previousWindow === undefined) delete global.window; else global.window = previousWindow; }
  assert.deepEqual(requests, [[sessionId, ra, '2026-09-06T00:00:00Z']]);
  const booked = h.render('ScheduleRoom', { ...base, session: { ...base.session, status: 'closed' }, bookings: [{ id: 'booking', resident_id: me, ra_id: ra, status: 'confirmed', start_at: '2026-09-06T00:00:00Z' }] });
  assert.ok(nodes(booked).some(node => textOf(node).includes("予約済みです")));
  assert.match(textOf(booked), /受付は終了/);
});

test('the schedule page passes an explicit booking grant only for current new residents on the target floor', async () => {
  for (const scenario of [
    { role: 'resident', account_kind: 'resident', floor: 3, current: true, open: true, expected: true },
    { role: 'resident', account_kind: 'resident', floor: 3, current: false, open: true, expected: false },
    { role: 'ra', account_kind: 'resident', floor: 3, current: true, open: true, expected: false },
    { role: 'resident', account_kind: 'service_desk', floor: null, current: true, open: true, expected: false },
    { role: 'resident', account_kind: 'resident', floor: 4, current: true, open: true, expected: false },
    { role: 'resident', account_kind: 'resident', floor: 3, current: true, open: false, expected: false },
  ]) {
    const calls = [];
    const session = { id: sessionId, kind: 'lets_chat', floor_number: 3, status: scenario.open ? 'open' : 'closed' };
    const db = {
      from(table) {
        const query = { select() { return query; }, eq() { return query; }, order() { return query; }, maybeSingle: async () => ({ data: table === 'schedule_sessions' ? session : null, error: null }), then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
        return query;
      },
      async rpc(name) { calls.push(name); return { data: name === 'is_current_new_resident' ? scenario.current : [], error: null }; },
    };
    const page = load('src/app/tools/schedule/[token]/page.tsx', {
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
      'next/navigation': { notFound() { throw Error('not found'); } },
      '@/components/tools/schedule-room': { ScheduleRoom: 'ScheduleRoom' },
      '@/lib/auth': { getCurrentProfile: async () => ({ id: me, role: scenario.role, account_kind: scenario.account_kind, floor_number: scenario.floor }) },
      '@/lib/management-access': { getManagementAccess: async () => ({ isRa: scenario.role === 'ra', permissions: [] }) },
      '@/lib/management-permissions': permissions,
      '@/lib/supabase/server': { createClient: async () => db },
    });
    const result = await page.default({ params: { token: 'fixture-token' } });
    assert.equal(result.props.canBook, scenario.expected, JSON.stringify(scenario));
    if (scenario.role !== 'resident' || scenario.account_kind !== 'resident' || scenario.floor !== 3 || !scenario.open) assert.ok(!calls.includes('is_current_new_resident'));
  }
});
