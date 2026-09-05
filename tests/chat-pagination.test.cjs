const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const projectRoot = process.env.WISH_PROJECT_ROOT || path.resolve(__dirname, '..');
const sourceRoot = process.env.WISH_SOURCE_ROOT || projectRoot;
const ts = createRequire(path.join(projectRoot, 'package.json'))('typescript');

function loadTs(relativePath, stubs = {}) {
  const source = fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (name in stubs) return stubs[name];
    if (name === '@/lib/message-cursor') return cursor;
    throw new Error(`Unexpected dependency: ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}
const cursor = loadTs('src/lib/message-cursor.ts');
const me = '11111111-1111-1111-1111-111111111111';
const friend = '22222222-2222-2222-2222-222222222222';
const eventId = '33333333-3333-3333-3333-333333333333';
const timestamp = '2026-09-05T09:00:00.123456+00:00';
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const messages = Array.from({ length: 97 }, (_, index) => ({
  id: id(index + 1),
  // 55 rows share a transaction time, spanning both initial and older pages.
  created_at: index < 20 ? '2026-09-05T08:00:00.000000+00:00'
    : index < 75 ? timestamp : '2026-09-05T10:00:00.000000+00:00',
  event_id: eventId, sender_id: me, recipient_id: friend, floor_number: 3,
  message_type: 'image', body: '', media_path: null, poll_id: null,
}));

function splitTerms(input) {
  const parts = [];
  let depth = 0, start = 0;
  for (let index = 0; index < input.length; index++) {
    if (input[index] === '(') depth++;
    if (input[index] === ')') depth--;
    if (input[index] === ',' && depth === 0) {
      parts.push(input.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}
function matches(row, expression) {
  const group = /^(and|or)\((.*)\)$/.exec(expression);
  if (group) {
    const values = splitTerms(group[2]).map((term) => matches(row, term));
    return group[1] === 'and' ? values.every(Boolean) : values.some(Boolean);
  }
  const field = /^(\w+)\.(eq|lt|gt)\.(.*)$/.exec(expression);
  assert.ok(field, `Recognized PostgREST expression: ${expression}`);
  const [, key, operator, value] = field;
  return operator === 'eq' ? row[key] === value : operator === 'lt' ? row[key] < value : row[key] > value;
}

function fakeSupabase({ failMessages = false } = {}) {
  function from(table) {
    let rows = ['event_messages', 'direct_messages', 'floor_messages'].includes(table)
      ? [...messages, { ...messages[0], id: id(999), event_id: 'other', recipient_id: 'other', floor_number: 4 }].reverse()
      : [];
    const orders = [];
    let maximum = Infinity;
    let single = false;
    const query = {
      select() { return this; },
      eq(key, value) { rows = rows.filter((row) => row[key] === value); return this; },
      gt(key, value) { rows = rows.filter((row) => row[key] > value); return this; },
      lt(key, value) { rows = rows.filter((row) => row[key] < value); return this; },
      in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return this; },
      or(expression) { rows = rows.filter((row) => splitTerms(expression).some((term) => matches(row, term))); return this; },
      order(key, options = {}) { orders.push([key, options.ascending !== false]); return this; },
      limit(value) { maximum = value; return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, reject) {
        if (failMessages && table.endsWith("messages")) return Promise.resolve({ data: null, error: { message: "Database unavailable" } }).then(resolve, reject);
        rows.sort((a, b) => {
          for (const [key, ascending] of orders) {
            const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
            if (comparison) return ascending ? comparison : -comparison;
          }
          return 0;
        });
        return Promise.resolve({ data: single ? rows[0] || null : rows.slice(0, maximum), count: rows.length, error: null }).then(resolve, reject);
      },
    };
    return query;
  }
  return { from, rpc: async () => ({ data: [], error: null }) };
}
function actions(file, database = fakeSupabase()) {
  return loadTs(`src/actions/${file}.ts`, {
    'next/cache': { revalidatePath() {} },
    'next/headers': {},
    '@/lib/management-access': { getManagementAccess: async () => ({ isRa: false, permissions: [] }) },
    '@/lib/management-permissions': { canManage: () => false },
    '@/lib/supabase/server': { createClient: async () => database },
    '@/lib/auth': { getCurrentProfile: async () => ({ id: me, floor_number: 3, moved_out_at: null }) },
    '@/lib/feature-flags': { getFeatureFlagState: async () => 'enabled' },
  });
}
for (const [name, file, initial, older] of [
  ['event', 'event-community', (a) => a.getInitialEventMessages(eventId, 7), (a, c) => a.getOlderEventMessages(eventId, c, 4)],
  ['direct', 'direct-messages', (a) => a.getInitialDirectMessages(friend, 7), (a, c) => a.getOlderDirectMessages(friend, c, 4)],
  ['floor', 'floor-messages', (a) => a.getInitialFloorMessages(7), (a, c) => a.getOlderFloorMessages(c, 4)],
]) {
  test(`${name} history: every message appears once across shared-timestamp boundaries`, async () => {
    const api = actions(file);
    let page = await initial(api);
    let collected = page.messages;
    let iterations = 0;
    while (page.hasMore) {
      assert.ok(iterations++ < 30, 'pagination makes progress');
      page = await older(api, { id: collected[0].id, created_at: collected[0].created_at });
      collected = [...page.messages, ...collected];
    }
    assert.deepEqual(collected.map((row) => row.id), messages.map((row) => row.id));
  });
}

test('forward recovery handles every shared timestamp without relying on device time', () => {
  let current = cursor.initialMessageCursor([]);
  const recovered = [];
  while (true) {
    const filter = cursor.messageCursorFilter(current, 'after');
    const page = messages.filter((row) => splitTerms(filter).some((term) => matches(row, term))).slice(0, 4);
    if (!page.length) break;
    recovered.push(...page);
    current = cursor.initialMessageCursor(page);
  }
  assert.deepEqual(recovered.map((row) => row.id), messages.map((row) => row.id));
});

test('realtime and recovery merge chronologically with one row per id', () => {
  const early = { id: id(2), created_at: timestamp, body: 'early' };
  const late = { id: id(1), created_at: timestamp.replace('123456', '123457'), body: 'late' };
  assert.deepEqual(cursor.mergeMessages([late], [early, late]), [early, late]);
  assert.deepEqual(cursor.mergeMessages([{ ...early, id: id(3) }], [early]).map((row) => row.id), [id(2), id(3)]);
});

test('cursor preserves microseconds and rejects injected filter syntax', () => {
  assert.ok(cursor.messageCursorFilter({ id: id(1), created_at: timestamp }).includes(timestamp));
  assert.throws(() => cursor.messageCursorFilter({ id: `${id(1)},id.gt.0`, created_at: timestamp }));
  assert.throws(() => cursor.messageCursorFilter({ id: id(1), created_at: `${timestamp}),id.gt.0` }));
});


// Execute each component's real callback body with controlled IO; no browser or database needed.
function componentCallback(file, pattern, context) {
  const source = fs.readFileSync(path.join(sourceRoot, `src/components/community/${file}.tsx`), 'utf8');
  const match = pattern.exec(source);
  assert.ok(match, `Find callback in ${file}`);
  const output = ts.transpileModule(`module.exports = async () => {${match[1]}\n};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(context), `const module = { exports: {} }; ${output}; return module.exports;`)(...Object.values(context));
}

for (const [component, file, olderName, recoverName] of [
  ['event-talk', 'event-community', 'getOlderEventMessages', 'getEventMessagesByIds'],
  ['friend-dm', 'direct-messages', 'getOlderDirectMessages', 'getDirectMessagesByIds'],
  ['floor-group-chat', 'floor-messages', 'getOlderFloorMessages', 'getFloorMessagesByIds'],
]) {
  test(`${component}: failed message hydration leaves recovery cursor available for retry`, async () => {
    const state = { current: cursor.initialMessageCursor([]) };
    const original = { ...state.current };
    let failHydration = true;
    let live = [];
    const recover = componentCallback(component, /const syncMissingMessages = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[[^\]]*\]\);/, {
      createClient: () => fakeSupabase(),
      messageCursorFilter: cursor.messageCursorFilter,
      mergeMessages: cursor.mergeMessages,
      recoveryCursorRef: state,
      eventId, friendId: friend, currentUserId: me, floorNumber: 3,
      [recoverName]: async (...args) => {
        const ids = args.at(-1);
        return { messages: failHydration ? [] : messages.filter((row) => ids.includes(row.id)) };
      },
      setLiveMessages: (update) => { live = update(live); },
    });
    await assert.rejects(recover(), /recovery incomplete/);
    assert.deepEqual(state.current, original);
    assert.deepEqual(live, []);
    failHydration = false;
    await recover();
    assert.equal(live.length, 50);
    assert.deepEqual(state.current, { created_at: messages[49].created_at, id: messages[49].id });
  });

  test(`${component}: history errors retain loaded messages and enable retry`, async () => {
    const api = actions(file, fakeSupabase({ failMessages: true }));
    const loadArgs = file === 'floor-messages' ? [messages[1]] : [file === 'event-community' ? eventId : friend, messages[1]];
    await assert.rejects(api[olderName](...loadArgs), /メッセージを読み込めませんでした/);
    const state = { loading: false, hasMore: true, error: null, messages: [messages[1]] };
    const load = componentCallback(component, /async function loadOlder\(\) \{([\s\S]*?)\n  \}/, {
      hasMoreOlderState: true, hasMore: true, loadingOlder: false,
      liveMessages: state.messages, scrollRef: { current: null },
      eventId, friendId: friend,
      [olderName]: async () => { throw new Error('Network unavailable'); },
      setLoadingOlder: (value) => { state.loading = value; },
      setError: (value) => { state.error = value; },
      setHasMore: (value) => { state.hasMore = value; },
      setHasMoreOlderState: (value) => { state.hasMore = value; },
      dict: { toast: { error: 'Please retry' } },
    });
    await load();
    assert.equal(state.loading, false);
    assert.equal(state.hasMore, true);
    assert.equal(state.error, 'Please retry');
    assert.deepEqual(state.messages, [messages[1]]);
  });
}
