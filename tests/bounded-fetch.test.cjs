const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness(fetch) {
  const timers = new Map(); let next = 0;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/supabase/bounded-fetch.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, Request, AbortController, DOMException,
    setTimeout: (fn) => { timers.set(++next, fn); return next; },
    clearTimeout: (id) => timers.delete(id) });
  return { read: exports.boundedFetch, timers };
}
test('stalled reads reject after their deadline and release the timer', async () => {
  const h = harness((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  }));
  const pending = h.read('https://example.test');
  const rejected = assert.rejects(pending, { name: 'TimeoutError' });
  [...h.timers.values()][0]();
  await rejected;
  assert.equal(h.timers.size, 0);
});
test('caller cancellation is preserved and successful reads clean up', async () => {
  let signal;
  const h = harness(async (url, init) => { signal = init.signal; return 'ok'; });
  const upstream = new AbortController(); upstream.abort('caller left');
  assert.equal(await h.read(new Request('https://example.test', { signal: upstream.signal })), 'ok');
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason, 'caller left');
  assert.equal(h.timers.size, 0);
});
test('writes retain the original request and are never automatically timed out', async () => {
  const init = { method: 'POST', body: 'message' };
  const h = harness(async (url, received) => { assert.equal(received, init); return 'saved'; });
  assert.equal(await h.read('https://example.test', init), 'saved');
  assert.equal(h.timers.size, 0);
});
