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
function harness({ allowed = true, error = null } = {}) {
  const calls = [];
  const stubs = {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': {}, '@/lib/feature-flags': {}, '@/lib/site-settings': {},
    '@/lib/beta-tools': {}, '@/lib/management-permissions': {},
    '@/lib/management-access': { requireManagement: async key => { assert.equal(key, 'links'); if (!allowed) throw Error('denied'); return { id: 'self' }; } },
    '@/lib/supabase/server': { createClient: async () => ({
      from() { throw Error('Non-atomic table write used'); },
      async rpc(name, args) { calls.push({ name, args }); return { data: error ? null : [{ id: 'hub', slug: args.p_slug }], error }; },
    }) },
  };
  return { action: load('src/actions/beta-tools.ts', stubs).saveRaLinkHub, calls };
}
const item = () => ({ title: ' Link ', url: ' https://example.com ', description: ' Info ', icon: 'link', enabled: true });
const input = () => ({ slug: ' My-links ', title: ' My page ', bio: ' Intro ', published: true, items: [item()] });
test('link save sends the whole validated replacement in one owner-scoped RPC', async () => {
  const h = harness();
  assert.deepEqual(await h.action(input()), { success: true, slug: 'my-links' });
  assert.deepEqual(h.calls, [{ name: 'save_ra_link_hub', args: { p_slug: 'my-links', p_title: 'My page', p_bio: 'Intro', p_published: true, p_items: [{ title: 'Link', url: 'https://example.com', description: 'Info', icon: 'link', enabled: true }] } }]);
  const max = harness();
  assert.equal((await max.action({ ...input(), items: Array.from({ length: 30 }, item) })).success, true);
  assert.equal(max.calls[0].args.p_items.length, 30);
  const empty = harness();
  assert.equal((await empty.action({ ...input(), items: [] })).success, true);
  assert.deepEqual(empty.calls[0].args.p_items, []);
});
test('invalid link replacements fail before any write; 31 links are not silently truncated', async () => {
  const invalid = [null, [null], Array.from({ length: 31 }, item), [{ ...item(), title: '' }], [{ ...item(), description: 'x'.repeat(121) }], [{ ...item(), icon: 'bad' }], [{ ...item(), enabled: 'true' }], [{ ...item(), url: 'javascript:alert(1)' }], [{ ...item(), url: 'https:///'}], [{ ...item(), url: `https://example.com/${'x'.repeat(1000)}` }]];
  for (const items of invalid) {
    const h = harness();
    assert.ok((await h.action({ ...input(), items })).error);
    assert.equal(h.calls.length, 0);
  }
});
test('permission denial and slug conflicts cannot report a successful save', async () => {
  const denied = harness({ allowed: false });
  await assert.rejects(denied.action(input()), /denied/);
  assert.equal(denied.calls.length, 0);
  const conflict = harness({ error: { code: '23505' } });
  assert.match((await conflict.action(input())).error, /すでに/);
  const failure = harness({ error: { code: '23514' } });
  assert.ok((await failure.action(input())).error);
  assert.equal(failure.calls.length, 1);
});
test('link editor page fails closed on either metadata or item fetch errors', async () => {
  for (const failedTable of ['ra_link_hubs', 'ra_link_items']) {
    let rendered = false;
    const page = load('src/app/dashboard/link-hub/page.tsx', {
      'react/jsx-runtime': { jsx() { rendered = true; }, jsxs() { rendered = true; } },
      '@/components/dashboard/link-hub-editor': {},
      '@/lib/management-access': { requireManagement: async () => ({ id: 'self' }) },
      '@/lib/supabase/server': { createClient: async () => ({ from(table) {
        const result = { data: table === 'ra_link_hubs' ? { id: 'hub' } : [], error: table === failedTable ? { message: 'offline' } : null };
        const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => result, order: async () => result };
        return query;
      } }) },
    });
    await assert.rejects(page.default(), /読み込めません/);
    assert.equal(rendered, false, 'Must not render an empty editor that could overwrite saved links');
  }
});
