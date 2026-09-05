const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function mount(component, search) {
  const navigations = [];
  const params = new URLSearchParams(search);
  const react = {
    useState(value) { return [value === false ? true : typeof value === 'function' ? value() : value, () => {}]; },
    useTransition: () => [false, (fn) => fn()],
    useEffect() {},
    useMemo: (fn) => fn(),
    useId: () => 'date-panel',
  };
  const jsx = (type, props) => ({ type, props });
  const dict = { home: new Proxy({}, { get: (_, key) => key }) };
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': {
      useSearchParams: () => params,
      usePathname: () => '/events',
      useRouter: () => ({ replace: (href) => navigations.push(href) }),
    },
    '@/lib/i18n/locale-provider': { useDict: () => dict, useLocale: () => 'en' },
    '@/lib/navigation-signal': { signalNavigation: () => true },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' '), toJstDateKey: (v) => v.slice(0, 10) },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' },
    'lucide-react': new Proxy({}, { get: (_, key) => key }),
  };
  const file = path.join(__dirname, '..', 'src/components/events', `${component}.tsx`);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (id) => {
    if (!modules[id]) throw Error(`Unexpected module ${id}`);
    return modules[id];
  }, URLSearchParams, Date });
  const tree = component === 'event-status-filter' ? exports.EventStatusFilter() : exports.EventCalendar({ eventDates: [] });
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map((n) => find(predicate, n)).find(Boolean);
    if (predicate(node)) return node;
    return node.props?.children == null ? undefined : find(predicate, node.props.children);
  }
  return { navigations, find };
}

for (const filter of ['date=2026-09-10', 'from=2026-09-01&to=2026-09-30', 'month=2026-09']) {
  for (const status of ['all', 'upcoming', 'past']) {
    test(`choosing ${status} clears ${filter} while retaining search/category`, () => {
      const { navigations, find } = mount('event-status-filter', `q=hello&category=RR&${filter}`);
      find((node) => node.type === 'button' && node.props.children === `status${status[0].toUpperCase()}${status.slice(1)}`).props.onClick();
      assert.equal(navigations.length, 1);
      const result = new URL(navigations[0], 'https://wish.test').searchParams;
      assert.equal(result.get('q'), 'hello');
      assert.equal(result.get('category'), 'RR');
      assert.equal(result.get('status'), status === 'all' ? null : status);
      for (const key of ['date', 'from', 'to', 'month']) assert.equal(result.has(key), false);
    });
  }
}

test('choosing a calendar date removes the previous status', () => {
  const { navigations, find } = mount('event-calendar', 'status=past&q=hello&category=RR');
  find((node) => node.type === 'button' && /^\d{4}-\d{2}-15$/.test(node.props['aria-label'] || '')).props.onClick();
  const result = new URL(navigations[0], 'https://wish.test').searchParams;
  assert.equal(result.has('status'), false);
  assert.match(result.get('date'), /^\d{4}-\d{2}-15$/);
  assert.equal(result.get('category'), 'RR');
  assert.equal(result.get('q'), 'hello');
});

test('a reversed range is disabled and cannot navigate even if invoked', () => {
  const { navigations, find } = mount('event-calendar', 'from=2026-09-20&to=2026-09-10');
  const apply = find((node) => node.type === 'button' && node.props.children === 'dateFilterApply');
  assert.equal(apply.props.disabled, true);
  apply.props.onClick();
  assert.equal(navigations.length, 0);
  assert(find((node) => node.props?.role === 'alert'));
});
