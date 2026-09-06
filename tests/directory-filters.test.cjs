const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/components/directory/directory-filters.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported, URLSearchParams });
const { matchesDirectoryFilters, directoryFilterHref, sharesLanguage } = exported;
const resident = { id: 'a', faculty: '国際教養学部', grade_level: '3', languages: ['ja', 'en'], nationalities: ['JP'], lived_countries: ['JP', 'KR'] };

test('each profile detail links to its exact directory condition with URL encoding', () => {
  for (const [field, value] of Object.entries({ faculty: '国際教養学部', grade_level: '3', languages: 'en', nationalities: 'JP', lived_countries: 'KR' })) {
    const url = new URL(directoryFilterHref(field, value), 'https://wish.test');
    assert.equal(url.pathname, '/directory');
    assert.equal(url.searchParams.get(field), value);
    assert.equal(matchesDirectoryFilters(resident, Object.fromEntries(url.searchParams)), true);
  }
});
test('multiple directory conditions must all match, with array membership and exact scalar matching', () => {
  assert.equal(matchesDirectoryFilters(resident, { languages: 'en', lived_countries: 'KR' }), true);
  assert.equal(matchesDirectoryFilters(resident, { languages: 'en', lived_countries: 'US' }), false);
  assert.equal(matchesDirectoryFilters(resident, { faculty: '国際' }), false);
  assert.equal(matchesDirectoryFilters(resident, { grade_level: '2' }), false);
});
test('hidden or absent fields never match a requested condition', () => {
  assert.equal(matchesDirectoryFilters({ ...resident, languages: null }, { languages: 'en' }), false);
  assert.equal(matchesDirectoryFilters({ ...resident, faculty: null }, { faculty: '国際教養学部' }), false);
  assert.equal(matchesDirectoryFilters({ id: 'private' }, { nationalities: 'JP' }), false);
  assert.equal(matchesDirectoryFilters(resident, {}), true);
});
test('shared-language discovery excludes self and respects missing fields', () => {
  assert.equal(sharesLanguage(resident, { id: 'b', languages: ['en'] }), true);
  assert.equal(sharesLanguage(resident, resident), false);
  assert.equal(sharesLanguage(resident, { id: 'b', languages: ['ko'] }), false);
  assert.equal(sharesLanguage(resident, { id: 'b', languages: null }), false);
  assert.equal(sharesLanguage({ id: 'b', languages: null }, resident), false);
});
