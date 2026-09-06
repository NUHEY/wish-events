const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/resident-tools.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
const flags = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/feature-flag-keys.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(flags, flags.exports);
new Function('require', 'module', 'exports', compiled)(id => id === '@/lib/feature-flag-keys' ? flags.exports : require(id), mod, mod.exports);
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

test('new tools obey hidden and beta states without losing home preferences', () => {
  const keys = ['resident_directory', 'share_qr', 'split_bill', 'group_shuffle', 'world_clock'];
  const tools = resolveHomeTools(keys.map(key => ({key, showOnHome:true})), keys.map((key,index) => ({key,state:index ? 'hidden':'beta',show_on_home:true,home_position:index})));
  for (const key of keys) {
    assert.equal(RESIDENT_TOOLS.find(tool => tool.key === key).featureKey, key);
    assert.equal(tools.find(tool => tool.key === key).state, key === 'resident_directory' ? 'beta' : 'hidden');
  }
});
