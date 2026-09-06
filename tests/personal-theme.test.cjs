const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: id => modules[id], ...globals });
  return exports;
}
const motion = load('src/lib/motion.ts');
const theme = load('src/lib/theme.ts', { '@/lib/motion': motion });
function browser(savedTheme = null, dark = false, blocked = false) {
  const saved = new Map(savedTheme ? [[theme.THEME_STORAGE_KEY, savedTheme]] : []);
  const events = new Map();
  const colors = { matches: dark, addEventListener: (_, fn) => events.set('color', fn), removeEventListener: () => events.delete('color') };
  const motions = { matches: false, addEventListener: (_, fn) => events.set('motion', fn), removeEventListener: () => events.delete('motion') };
  const root = { dataset: {}, style: {}, classList: { toggle: (_, value) => { root.dark = value; }, contains: () => root.dark }, dark };
  const document = { documentElement: root };
  const localStorage = {
    getItem: key => { if (blocked) throw Error('blocked'); return saved.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); saved.set(key, value); },
  };
  const window = {
    matchMedia: query => query.includes('color-scheme') ? colors : motions,
    addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key), dispatchEvent() {},
  };
  return { document, localStorage, window, saved, colors, motions, events, root };
}
function provider(browser) {
  const cleanups = [];
  const { ThemeProvider } = load('src/components/layout/theme-provider.tsx', {
    react: { createContext: () => ({ Provider: 'Provider' }), useState: value => [value, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => cleanups.push(fn()) },
    'react/jsx-runtime': { jsx: (_, props) => props }, '@/lib/theme': theme, '@/lib/motion': { ...motion, shouldReduceMotion: () => false },
  }, { ...browser, Event });
  return { settings: ThemeProvider({ children: null }).value, cleanups };
}
test('theme boot follows system for absent, system, and invalid choices; explicit choices win', () => {
  for (const [saved, os, expected] of [[null, true, true], ['system', true, true], ['invalid', true, true], ['light', true, false], ['dark', false, true]]) {
    const b = browser(saved, os);
    vm.runInNewContext(theme.themeInitScript, b);
    assert.equal(b.root.dark, expected);
    assert.equal(b.root.style.colorScheme, expected ? 'dark' : 'light');
  }
  const blocked = browser(null, true, true);
  vm.runInNewContext(theme.themeInitScript, blocked);
  assert.equal(blocked.root.dark, true);
});
test('system theme tracks OS changes and explicit choice stops automatic switching', () => {
  const b = browser();
  const { settings, cleanups } = provider(b);
  b.colors.matches = true; b.events.get('color')();
  assert.equal(b.root.dark, true);
  settings.setTheme('light');
  b.events.get('color')();
  assert.equal(b.root.dark, false);
  assert.equal(b.saved.get(theme.THEME_STORAGE_KEY), 'light');
  settings.setTheme('system');
  assert.equal(b.root.dark, true);
  cleanups.forEach(fn => fn());
  assert.equal(b.events.size, 0);
});
test('storage changes synchronize theme and text size; clearing returns to defaults', () => {
  const b = browser('light', true);
  provider(b);
  b.saved.set(theme.THEME_STORAGE_KEY, 'dark'); b.events.get('storage')({ key: theme.THEME_STORAGE_KEY });
  assert.equal(b.root.dark, true);
  b.saved.set(theme.TEXT_SIZE_STORAGE_KEY, 'large'); b.events.get('storage')({ key: theme.TEXT_SIZE_STORAGE_KEY });
  assert.equal(b.root.dataset.textSize, 'large');
  b.saved.clear(); b.events.get('storage')({ key: null });
  assert.equal(b.root.dark, true);
  assert.equal(b.root.dataset.textSize, 'standard');
});
test('text size is applied before hydration and personal changes persist immediately', () => {
  const b = browser();
  b.saved.set(theme.TEXT_SIZE_STORAGE_KEY, 'large');
  vm.runInNewContext(theme.themeInitScript, b);
  assert.equal(b.root.dataset.textSize, 'large');
  const { settings } = provider(b);
  settings.setTextSize('standard');
  assert.equal(b.root.dataset.textSize, 'standard');
  assert.equal(b.saved.get(theme.TEXT_SIZE_STORAGE_KEY), 'standard');
});
test('theme and text settings still work when storage is unavailable', () => {
  const b = browser(null, true, true);
  const { settings } = provider(b);
  settings.setTheme('light');
  b.events.get('color')();
  assert.equal(b.root.dark, false);
  settings.setTextSize('large');
  assert.equal(b.root.dataset.textSize, 'large');
});
test('system motion changes respect an explicit saved motion preference', () => {
  const b = browser();
  provider(b);
  b.saved.set(motion.MOTION_STORAGE_KEY, 'false');
  b.motions.matches = true; b.events.get('motion')();
  assert.equal(b.root.dataset.motion, 'full');
  b.saved.delete(motion.MOTION_STORAGE_KEY); b.events.get('storage')({ key: motion.MOTION_STORAGE_KEY });
  assert.equal(b.root.dataset.motion, 'reduce');
});
