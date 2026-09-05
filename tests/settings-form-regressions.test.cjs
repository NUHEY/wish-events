const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/actions/site-settings.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(allowed = true) {
  const updates = [];
  const mod = { exports: {} };
  const deps = {
    'next/cache': { revalidatePath() {} },
    '@/lib/management-access': { requireManagement: async key => { assert.equal(key, 'settings'); if (!allowed) throw Error('denied'); return { id: 'manager' }; } },
    '@/lib/supabase/server': { createClient: async () => ({ from: table => { assert.equal(table, 'site_settings'); return { update: values => { updates.push(values); return { eq: async () => ({ error: null }) }; } }; } }) },
  };
  new Function('require', 'module', 'exports', source)(id => { if (!(id in deps)) throw Error(id); return deps[id]; }, mod, mod.exports);
  return { actions: mod.exports, updates };
}
test('blank or missing optional numeric site settings restore recommended defaults instead of minimum values', async () => {
  for (const blank of [false, true]) {
    const h = harness(); const form = new FormData();
    if (blank) for (const key of ['navigation_stall_seconds', 'mobile_touch_feedback_ms', 'cta_blur_px', 'cta_fade_height_px', 'cta_transition_ms']) form.set(key, '');
    assert.equal((await h.actions.updateSiteSettings({}, form)).success, true);
    const saved = h.updates[0];
    assert.equal(saved.navigation_stall_seconds, 8);
    assert.equal(saved.mobile_touch_feedback_ms, 180);
    assert.equal(saved.cta_blur_px, 16);
    assert.equal(saved.cta_fade_height_px, 64);
    assert.equal(saved.cta_transition_ms, 200);
  }
});
test('explicit zero blur and chosen display values are preserved while invalid numbers use safe defaults', async () => {
  const h = harness(); const form = new FormData();
  form.set('cta_blur_px', '0'); form.set('navigation_stall_seconds', 'not-a-number'); form.set('mobile_touch_feedback_ms', '240');
  await h.actions.updateSiteSettings({}, form);
  assert.equal(h.updates[0].cta_blur_px, 0);
  assert.equal(h.updates[0].navigation_stall_seconds, 8);
  assert.equal(h.updates[0].mobile_touch_feedback_ms, 240);
  const display = new FormData(); display.set('event_label_duration_ms', ''); display.set('event_label_limit', '0');
  await h.actions.updateEventDisplaySettings({}, display);
  assert.equal(h.updates[1].event_label_duration_ms, 3600);
  assert.equal(h.updates[1].event_label_limit, 0);
});
test('both shared settings forms reject callers without site appearance permission before writing', async () => {
  const h = harness(false);
  await assert.rejects(h.actions.updateSiteSettings({}, new FormData()), /denied/);
  await assert.rejects(h.actions.updateEventDisplaySettings({}, new FormData()), /denied/);
  assert.equal(h.updates.length, 0);
});
