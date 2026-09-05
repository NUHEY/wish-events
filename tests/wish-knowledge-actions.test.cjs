const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(source, stubs) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(id => {
    if (!(id in stubs)) throw Error(`Unexpected dependency: ${id}`);
    return stubs[id];
  }, mod, mod.exports);
  return mod.exports;
}
const source = compile('src/actions/wish-knowledge.ts');
const permissions = load(compile('src/lib/management-permissions.ts'), {});
const me = '11111111-1111-4111-8111-111111111111';
const questionId = '22222222-2222-4222-8222-222222222222';
function harness({ kind = 'resident', role = 'resident', grants = [], flag = 'public', question = { id: questionId, answer_scope: 'ra_only' }, feedError = null, deleteError = null } = {}) {
  const calls = [], revalidated = [];
  let clients = 0;
  const profile = { id: me, role, account_kind: kind };
  const db = {
    from(table) {
      return { insert(values) { calls.push({ table, values }); return { select() { return this; }, single: async () => ({ data: { id: questionId, ...values }, error: null }) }; } };
    },
    rpc(name, args) {
      calls.push({ name, args });
      if (name === 'wish_question_feed') return {
        eq(field, value) { calls.push({ filter: [field, value] }); return this; },
        returns() { return this; }, maybeSingle: async () => ({ data: question, error: feedError }),
      };
      if (name === 'delete_wish_question') return Promise.resolve({ error: deleteError });
      throw Error(`Unexpected RPC: ${name}`);
    },
  };
  const actions = load(source, {
    'next/cache': { revalidatePath: p => revalidated.push(p) },
    '@/lib/supabase/server': { createClient: async () => { clients++; return db; } },
    '@/lib/auth': { getCurrentProfile: async () => profile },
    '@/lib/management-access': { getManagementAccess: async () => ({ isRa: role === 'ra' && kind === 'resident', permissions: grants }) },
    '@/lib/management-permissions': permissions,
    '@/lib/feature-flags': { getFeatureFlagState: async () => flag },
  });
  return { actions, calls, revalidated, clients: () => clients };
}
const input = () => ({ title: '質問', body: '質問内容', category: 'life', visibility: 'public', answer_scope: 'everyone' });

test('private questions force RA-only answers even when a modified client requests everyone', async () => {
  const h = harness();
  const result = await h.actions.createWishQuestion({ ...input(), visibility: 'ra_only' });
  assert.ok(result.question);
  assert.equal(h.calls[0].table, 'wish_questions');
  assert.equal(h.calls[0].values.visibility, 'ra_only');
  assert.equal(h.calls[0].values.answer_scope, 'ra_only');
  assert.equal(h.calls[0].values.asked_by, me);
});

test('unknown or omitted question scopes cannot fall back to publishing the question', async () => {
  for (const override of [{ visibility: 'everyone' }, { visibility: null }, { visibility: undefined }, { answer_scope: 'staff' }, { answer_scope: undefined }]) {
    const h = harness();
    assert.ok((await h.actions.createWishQuestion({ ...input(), ...override })).error);
    assert.equal(h.clients(), 0);
    assert.equal(h.revalidated.length, 0);
  }
});

test('RA-only answers require the real resident RA identity, not delegated questions management', async () => {
  for (const profile of [{ kind: 'resident', role: 'resident' }, { kind: 'service_desk', role: 'resident' }, { kind: 'university_staff', role: 'ra' }]) {
    const h = harness({ ...profile, grants: ['questions'] });
    assert.match((await h.actions.createWishAnswer(questionId, '回答')).error, /RAのみ/);
    assert.ok(!h.calls.some(c => c.table === 'wish_answers'));
  }
  const ra = harness({ role: 'ra' });
  assert.ok((await ra.actions.createWishAnswer(questionId, '回答')).answer);
  assert.equal(ra.calls.find(c => c.table === 'wish_answers').values.answered_by, me);
  assert.deepEqual(ra.calls.find(c => c.filter).filter, ['id', questionId]);
  const open = harness({ kind: 'service_desk', question: { id: questionId, answer_scope: 'everyone' } });
  assert.ok((await open.actions.createWishAnswer(questionId, '通常の回答')).answer);
});

test('missing or unreadable feed rows cannot be answered even by an RA', async () => {
  for (const result of [{ question: null }, { feedError: { code: 'network' } }]) {
    const h = harness({ role: 'ra', ...result });
    assert.ok((await h.actions.createWishAnswer(questionId, '回答')).error);
    assert.ok(!h.calls.some(c => c.table === 'wish_answers'));
  }
});

test('hidden knowledge rejects ordinary writes but allows its delegated moderator and real RA', async () => {
  for (const opts of [{}, { kind: 'service_desk', grants: ['events'] }]) {
    const h = harness({ flag: 'hidden', ...opts });
    assert.ok((await h.actions.createWishQuestion(input())).error);
    assert.ok((await h.actions.createWishAnswer(questionId, '回答')).error);
    assert.equal(h.clients(), 0);
  }
  for (const opts of [{ kind: 'service_desk', grants: ['questions'] }, { role: 'ra' }]) {
    const h = harness({ flag: 'hidden', ...opts });
    assert.ok((await h.actions.createWishQuestion(input())).question);
  }
});

test('question deletion uses the privacy-aware RPC and propagates its denial without false success', async () => {
  const ok = harness();
  assert.equal((await ok.actions.deleteWishQuestion(questionId)).success, true);
  assert.deepEqual(ok.calls, [{ name: 'delete_wish_question', args: { p_question_id: questionId } }]);
  const denied = harness({ deleteError: { message: 'permission denied' } });
  const result = await denied.actions.deleteWishQuestion(questionId);
  assert.match(result.error, /permission denied/);
  assert.equal(result.success, undefined);
  assert.equal(denied.revalidated.length, 0);
  const invalid = harness();
  assert.ok((await invalid.actions.deleteWishQuestion('invalid')).error);
  assert.equal(invalid.clients(), 0);
});
