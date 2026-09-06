const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, modules = {}) {
  const output = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(output, key => { if (!(key in modules)) throw Error(key); return modules[key]; });
  return output;
}
const constants = load('src/lib/constants.ts');
const { EMPTY_EVENT_FILTER: empty, readEventFilter, eventFilterParams, eventFilterError } = load('src/lib/event-filter-state.ts', { '@/lib/constants': constants });
for (const [mode, values] of [['single', {date:'2026-09-12'}], ['range', {from:'2026-09-01',to:'2026-10-02'}], ['month', {month:'2026-10'}]]) {
  test(`${mode} applies category and dates together while clearing stale date/status values`, () => {
    const draft = {...empty,category:'SI',timing:'custom',dateMode:mode,...values};
    const params=eventFilterParams(new URLSearchParams('q=welcome&category=RR&status=past&date=2025-01-01&month=2025-02&from=2025-03-01'), draft);
    assert.equal(params.get('q'),'welcome'); assert.equal(params.get('category'),'SI'); assert.equal(params.has('status'),false);
    for (const key of ['date','from','to','month']) assert.equal(params.get(key), values[key] || null);
    assert.equal(eventFilterError(draft),null);
  });
}
test('status selection and reset preserve keyword search without hidden date filters',()=>{
  const params=new URLSearchParams('q=party&category=RR&from=2026-09-01&month=2026-10');
  assert.equal(eventFilterParams(params,{...empty,timing:'upcoming'}).toString(),'q=party&status=upcoming');
  assert.equal(eventFilterParams(params,empty).toString(),'q=party');
});
test('URL date precedence matches server resolution and restores edits on return navigation',()=>{
  assert.equal(readEventFilter(new URLSearchParams('status=past&date=2026-09-01&from=2026-08-01')).dateMode,'single');
  assert.equal(readEventFilter(new URLSearchParams('status=past&month=2026-09')).timing,'custom');
  assert.equal(readEventFilter(new URLSearchParams('status=past')).timing,'past');
});
test('invalid or reversed dates are rejected, with open-ended ranges supported',()=>{
  assert.equal(eventFilterError({...empty,timing:'custom',date:'2026-02-30'}),'date');
  assert.equal(eventFilterError({...empty,timing:'custom',date:'2028-02-29'}),null);
  assert.equal(eventFilterError({...empty,timing:'custom',dateMode:'range',from:'2026-10-02',to:'2026-10-01'}),'range');
  assert.equal(eventFilterError({...empty,timing:'custom',dateMode:'range',from:'2026-10-02'}),null);
  assert.equal(eventFilterError({...empty,timing:'custom',dateMode:'month',month:'2026-13'}),'month');
});
