const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/resident-tools.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
const { resolveHomeTools, RESIDENT_TOOLS } = mod.exports;

test('legacy home visibility and order survive while standalone tools are available', () => {
  const tools = resolveHomeTools(null, [
    { key: 'wish_knowledge', state: 'public', show_on_home: false, home_position: 1 },
    { key: 'availability_matching', state: 'beta', show_on_home: true, home_position: 2 },
  ]);
  assert.equal(tools[0].key, 'wish_knowledge');
  assert.equal(tools[0].showOnHome, false);
  assert.equal(tools.find(t => t.key === 'availability_matching').state, 'beta');
  assert.equal(tools.find(t => t.key === 'share_qr').state, 'public');
  assert.equal(tools.find(t => t.key === 'resident_events').state, 'hidden');
});
test('saved ordering is exact and visibility never overrides feature publication', () => {
  const tools = resolveHomeTools([
    { key: 'world_clock', showOnHome: true },
    { key: 'resident_events', showOnHome: true },
    { key: 'split_bill', showOnHome: false },
    { key: 'world_clock', showOnHome: false },
  ], [{ key: 'resident_events', state: 'hidden', show_on_home: true, home_position: 1 }]);
  assert.deepEqual(tools.slice(0, 3).map(t => t.key), ['world_clock', 'resident_events', 'split_bill']);
  assert.equal(tools[1].state, 'hidden');
  assert.equal(tools[2].showOnHome, false);
  assert.equal(tools.length, RESIDENT_TOOLS.length);
  assert.equal(new Set(tools.map(t => t.key)).size, RESIDENT_TOOLS.length);
});
