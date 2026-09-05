const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function mount(lockEnabled = true) {
  const effects = [], handlers = new Map(), timers = new Map();
  let timerId = 0;
  let loading = false, observer;
  class MutationObserver { constructor(fn) { observer = fn; } observe() {} disconnect() {} }
  const location = new URL('https://wish.test/events');
  const window = {
    location,
    matchMedia: () => ({ matches: true }),
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener() {},
  };
  const document = { body: {}, querySelector: () => loading ? {} : null, addEventListener: window.addEventListener, removeEventListener() {} };
  const mocks = {
    react: { useRef: current => ({ current }), useState: value => [value, () => {}], useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx() {}, jsxs() {} },
    'next/navigation': { usePathname: () => location.pathname, useSearchParams: () => location.searchParams },
    '@/lib/navigation-signal': { NAVIGATION_START_EVENT: 'wish:navigation-start', NAVIGATION_END_EVENT: 'wish:navigation-end' },
    '@/lib/i18n/locale-provider': { useDict: () => ({ common: {} }) },
  };
  const filename = path.join(__dirname, '../src/components/layout/navigation-feedback.tsx');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URL, window, document, location, FormData, MutationObserver, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  } }, { filename });
  exports.NavigationFeedback({ lockEnabled });
  effects.forEach(fn => fn());
  return {
    send(name, extra = {}) {
      const event = { defaultPrevented: false, button: 0, target: { closest: () => null },
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
      handlers.get(name)(event);
      return event;
    },
    finishRoute: () => effects[0](),
    setLoading(value) { loading = value; observer(); },
    tick() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); } },
  };
}

test('mount settle timer cannot unlock a newly started mobile navigation', () => {
  const app = mount();
  assert.equal(app.send('wish:navigation-start', { detail: { href: '/talks' } }).defaultPrevented, false);
  app.tick();
  assert.equal(app.send('wish:navigation-start', { detail: { href: '/' } }).defaultPrevented, true);
  app.finishRoute();
  app.tick();
  assert.equal(app.send('wish:navigation-start', { detail: { href: '/' } }).defaultPrevented, false);
});

test('navigation blocks immediate button clicks and form submissions', () => {
  const app = mount();
  app.send('wish:navigation-start', { detail: { href: '/talks' } });
  for (const name of ['click', 'submit']) {
    const event = app.send(name);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.stopped, true);
  }
});

test('slow-navigation recovery button stays usable while locked', () => {
  const app = mount();
  app.send('wish:navigation-start', { detail: { href: '/talks' } });
  const event = app.send('click', { target: { closest: selector => selector === '[data-navigation-recovery]' ? {} : null } });
  assert.equal(event.defaultPrevented, false);
});

test('a canceled GET submission does not start navigation', () => {
  const app = mount();
  app.send('submit', { defaultPrevented: true, target: { method: 'get', action: 'https://wish.test/talks' } });
  assert.equal(app.send('wish:navigation-start', { detail: { href: '/' } }).defaultPrevented, false);
});

test('disabled navigation lock preserves normal button interaction', () => {
  const app = mount(false);
  app.send('wish:navigation-start', { detail: { href: '/talks' } });
  assert.equal(app.send('click').defaultPrevented, false);
  assert.equal(app.send('wish:navigation-start', { detail: { href: '/' } }).defaultPrevented, false);
});


test('streaming loading UI keeps route locked until content arrives', () => {
  const app = mount();
  app.send('wish:navigation-start', { detail: { href: '/talks' } });
  app.setLoading(true);
  app.finishRoute();
  app.tick();
  assert.equal(app.send('click').defaultPrevented, true);
  app.setLoading(false);
  app.tick();
  assert.equal(app.send('click').defaultPrevented, false);
});

test('error boundary and back-forward cache restore unlock recovery controls', () => {
  for (const [name, extra] of [['wish:navigation-end', {}], ['pageshow', {persisted:true}]]) {
    const app = mount();
    app.send('wish:navigation-start', { detail: { href: '/talks' } });
    app.send(name, extra);
    assert.equal(app.send('click').defaultPrevented, false);
  }
});

test('ordinary pageshow cannot clear a navigation started before load completes', () => {
  const app = mount();
  app.send('wish:navigation-start', { detail: { href: '/talks' } });
  app.send('pageshow', {persisted:false});
  assert.equal(app.send('click').defaultPrevented, true);
});
