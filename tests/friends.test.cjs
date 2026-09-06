const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const self = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
function load(file, stubs) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id in stubs) return stubs[id];
    throw Error(`Unexpected dependency ${id}`);
  }, module, module.exports);
  return module.exports;
}
function actions(results) {
  const calls = [], paths = [];
  const api = load('src/actions/friends.ts', {
    'next/cache': { revalidatePath: path => paths.push(path) },
    '@/lib/auth': { getCurrentProfile: async () => ({ id: self }) },
    '@/lib/supabase/server': { createClient: async () => ({
      rpc() { const result = results.shift(); assert.ok(result, 'Unexpected RPC'); return { returns: async () => result }; },
      from(table) {
      assert.equal(table, 'friend_requests');
      const result = results.shift();
      assert.ok(result, 'Unexpected query');
      const query = {};
      for (const method of ['select', 'or', 'eq', 'update', 'delete', 'insert', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
      query.maybeSingle = query.single = async () => result;
      query.returns = async () => ({ ...result, data: result.data == null ? [] : Array.isArray(result.data) ? result.data : [result.data] });
      query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return query;
    } }) },
  });
  return { api, calls, paths };
}
test('sending returns stored ID so cancellation works immediately', async () => {
  const h = actions([{ data: null }, { data: { id: requestId } }]);
  assert.deepEqual(await h.api.sendFriendRequest(target), { success: true, relation: { status: 'pending_sent', requestId } });
  assert.ok(h.calls.some(([method, values]) => method === 'insert' && values.requester_id === self && values.addressee_id === target));
});
test('crossed requests accept the incoming row using the addressee restriction', async () => {
  const h = actions([{ data: { id: requestId, requester_id: target, status: 'pending' } }, { data: { requester_id: target, addressee_id: self } }]);
  assert.equal((await h.api.sendFriendRequest(target)).relation.status, 'friends');
  assert.ok(h.calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'addressee_id', self])));
  assert.ok(h.calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'status', 'pending'])));
  assert.equal(h.calls.some(([method]) => method === 'insert'), false);
});
test('existing accepted or outgoing requests return their real status and ID', async () => {
  for (const [status, expected] of [['accepted', 'friends'], ['pending', 'pending_sent']]) {
    const h = actions([{ data: { id: requestId, requester_id: self, status } }]);
    assert.deepEqual((await h.api.sendFriendRequest(target)).relation, { status: expected, requestId });
  }
});
test('invalid IDs and self requests never write', async () => {
  const h = actions([]);
  assert.ok((await h.api.sendFriendRequest(self)).error);
  assert.ok((await h.api.sendFriendRequest('bad')).error);
  assert.ok((await h.api.acceptFriendRequest('bad')).error);
  assert.ok((await h.api.removeFriendRequest('bad')).error);
  assert.equal(h.calls.length, 0);
});
test('failed reads do not create a new request, and unreadable relationships fail closed', async () => {
  const h = actions([{ data: null, error: { message: 'offline' } }]);
  assert.ok((await h.api.sendFriendRequest(target)).error);
  assert.equal(h.calls.some(([method]) => method === 'insert'), false);
  await assert.rejects(actions([{ data: null, error: {} }]).api.getFriendRelation(target));
});
test('zero-row, forbidden, or failed mutations never report success', async () => {
  for (const method of ['acceptFriendRequest', 'removeFriendRequest']) {
    for (const result of [{ data: null }, { data: null, error: { message: 'denied' } }]) {
      const h = actions([result]);
      assert.ok((await h.api[method](requestId)).error);
      assert.deepEqual(h.paths, []);
    }
  }
});
test('cancellation restricts participants and returns cleared state', async () => {
  const h = actions([{ data: { requester_id: self, addressee_id: target } }, { data: [{ id: requestId }] }]);
  assert.deepEqual((await h.api.removeFriendRequest(requestId)).relation, { status: 'none', requestId: null });
  assert.ok(h.calls.some(([method, value]) => method === 'or' && value.includes(`requester_id.eq.${self}`) && value.includes(`addressee_id.eq.${self}`)));
  assert.ok(h.paths.includes('/talks') && h.paths.includes('/'));
});
function component(file, name, props, api) {
  let cursor = 0;
  const states = [];
  const element = (type, props) => ({ type, props });
  const exports = load(file, {
    react: {
      useState(initial) { const key = cursor++; if (!(key in states)) states[key] = initial; return [states[key], next => { states[key] = typeof next === 'function' ? next(states[key]) : next; }]; },
      useRef(initial) { const key = cursor++; if (!(key in states)) states[key] = { current: initial }; return states[key]; },
      useEffect() {},
    },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'lucide-react': { UserPlus: 'plus', UserCheck: 'check', UserX: 'cross' },
    'next/image': { default: 'image' },
    '@/lib/media-defaults': { DEFAULT_AVATAR_IMAGE_URL: '/avatar.png' },
    '@/components/ui/button': { Button: 'button' },
    '@/lib/i18n/locale-provider': { useDict: () => ({ directory: { friendAddButton: 'Add', friendPendingSentButton: 'Cancel', friendActionError: 'Error' } }) },
    '@/actions/friends': api,
  });
  return () => { cursor = 0; return exports[name](props); };
}
function flatten(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('friend button locks repeated sends, stores the ID, and permits immediate cancel', async () => {
  let resolve, sent = 0, cancelled;
  const render = component('src/components/community/friend-button.tsx', 'FriendButton', { targetId: target, initial: { status: 'none', requestId: null } }, {
    sendFriendRequest: () => { sent++; return new Promise(r => { resolve = r; }); },
    removeFriendRequest: async id => { cancelled = id; return { success: true, relation: { status: 'none', requestId: null } }; },
  });
  const click = flatten(render()).find(n => n.type === 'button').props.onClick;
  click(); click();
  assert.equal(sent, 1);
  assert.equal(flatten(render()).find(n => n.type === 'button').props.disabled, true);
  resolve({ success: true, relation: { status: 'pending_sent', requestId } });
  await tick();
  flatten(render()).find(n => n.type === 'button').props.onClick();
  await tick();
  assert.equal(cancelled, requestId);
});
test('failed or thrown incoming responses retain the request with an error', async () => {
  for (const fail of [async () => ({ error: 'offline' }), async () => { throw Error('offline'); }]) {
    const render = component('src/components/community/incoming-friend-requests.tsx', 'IncomingFriendRequests', { requests: [{ id: requestId, requester: { full_name: 'Test' } }] }, { acceptFriendRequest: fail });
    await flatten(render()).find(n => n.type === 'button').props.onClick();
    const nodes = flatten(render());
    assert.equal(nodes.filter(n => n.type === 'button').length, 2);
    assert.ok(nodes.some(n => n.props?.role === 'alert'));
    assert.equal(nodes.find(n => n.type === 'button').props.disabled, false);
  }
});

const reverseId = '44444444-4444-4444-8444-444444444444';
const outgoing = { id: requestId, requester_id: self, addressee_id: target, status: 'pending' };
const incoming = { id: reverseId, requester_id: target, addressee_id: self, status: 'pending' };
test('opposite simultaneous requests resolve as incoming, then accepted takes precedence', async () => {
  for (const rows of [[outgoing, incoming], [incoming, outgoing]]) {
    assert.deepEqual(await actions([{ data: rows }]).api.getFriendRelation(target), { status: 'pending_received', requestId: reverseId });
  }
  for (const rows of [[{ ...outgoing, status: 'accepted' }, incoming], [incoming, { ...outgoing, status: 'accepted' }]]) {
    assert.deepEqual(await actions([{ data: rows }]).api.getFriendRelation(target), { status: 'friends', requestId });
  }
});
test('send handles both directions by accepting incoming and does not insert another row', async () => {
  const h = actions([{ data: [outgoing, incoming] }, { data: { requester_id: target, addressee_id: self } }]);
  assert.deepEqual((await h.api.sendFriendRequest(target)).relation, { status: 'friends', requestId: reverseId });
  assert.equal(h.calls.some(([method]) => method === 'insert'), false);
});
test('a same-direction concurrent insert recovers the stored relationship on uniqueness conflict', async () => {
  const h = actions([{ data: [] }, { data: null, error: { code: '23505' } }, { data: [outgoing] }]);
  assert.deepEqual((await h.api.sendFriendRequest(target)).relation, { status: 'pending_sent', requestId });
});
test('removal deletes only both directions of the verified pair', async () => {
  const h = actions([{ data: incoming }, { data: [{ id: requestId }, { id: reverseId }] }]);
  assert.equal((await h.api.removeFriendRequest(reverseId)).success, true);
  const filters = h.calls.filter(([method]) => method === 'or').map(([, value]) => value);
  assert.equal(filters[0], `requester_id.eq.${self},addressee_id.eq.${self}`);
  assert.equal(filters[1], `and(requester_id.eq.${self},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${self})`);
});
test('failed pair deletion is not reported as cancelled', async () => {
  for (const result of [{ data: [] }, { data: null, error: { message: 'offline' } }]) {
    const h = actions([{ data: outgoing }, result]);
    assert.ok((await h.api.removeFriendRequest(requestId)).error);
    assert.deepEqual(h.paths, []);
  }
});
test('incoming list hides a pending reverse row when the pair is already friends', async () => {
  const h = actions([{ data: [{ ...outgoing, status: 'accepted' }, incoming] }]);
  assert.deepEqual(await h.api.getIncomingFriendRequests(), []);
});

test('incoming request lookup failure is surfaced instead of an empty inbox', async () => {
  const h = actions([{ data: null, error: { message: 'offline' } }]);
  await assert.rejects(h.api.getIncomingFriendRequests(), /友達申請を読み込めません/);
});
test('requester profile lookup failure is surfaced instead of anonymous requesters', async () => {
  const h = actions([{ data: [incoming] }, { data: null, error: { message: 'offline' } }]);
  await assert.rejects(h.api.getIncomingFriendRequests(), /プロフィールを読み込めません/);
});
