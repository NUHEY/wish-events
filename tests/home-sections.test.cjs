const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const jsx = (type, props, key) => ({ type, props, key });
const eventKeys = ['week_events', 'floor_events', 'featured_events', 'popular_events', 'friends_events', 'resident_events', 'latest_events'];
function descendants(node, predicate, result = []) {
  if (Array.isArray(node)) node.forEach(child => descendants(child, predicate, result));
  else if (node && typeof node === 'object') {
    if (predicate(node)) result.push(node);
    descendants(node.props?.children, predicate, result);
  }
  return result;
}
async function home({ populated = false, hidden = [] } = {}) {
  const event = { id: 'event-1', creator_type: 'ra', event_date: '2099-09-08T10:00:00Z', created_at: '2099-09-01T10:00:00Z' };
  const query = data => new Proxy({}, { get: (_, key) => key === 'then' ? resolve => Promise.resolve({ data, error: null }).then(resolve) : () => query(data) });
  const supabase = {
    from(table) {
      if (table === 'home_layout_sections') return query(hidden.map(section_key => ({ id: section_key, section_key, visible: false, position: 1 })));
      return query(table === 'events' && populated ? [event] : []);
    },
    rpc(name) {
      if (!populated) return query([]);
      if (name === 'popular_upcoming_events') return query([{ event_id: event.id, registration_count: 1 }]);
      if (name === 'friends_attending_events') return query([{ event_id: event.id, friend_id: 'friend-1' }]);
      return query([{ id: 'friend-1', full_name: 'Friend One', avatar_url: '/friend.png', role: 'resident' }]);
    },
  };
  const titles = Object.fromEntries(['weekEvents', 'floorEvents', 'featuredEvents', 'popularEvents', 'friendsEvents'].map(key => [key, { title: key, titleNoFloor: key }]));
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'next/link': { default: 'Link' },
    'lucide-react': {}, '@/lib/management-access': {}, '@/lib/management-permissions': {},
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/auth': { getCurrentProfile: async () => ({ role: 'ra', account_kind: 'resident', floor_number: 1, full_name: 'RA' }) },
    '@/components/announcements/announcement-card': { AnnouncementCard: 'AnnouncementCard' },
    '@/components/events/event-card': { EventCard: 'EventCard' },
    '@/components/tools/resident-tool-grid': { ResidentToolGrid: 'ResidentToolGrid' },
    '@/lib/resident-tools': { RESIDENT_TOOLS: [], resolveHomeTools: () => [] },
    '@/components/ui/button': { buttonVariants: () => '' },
    '@/lib/i18n': { getLocale: async () => 'ja', getDictionary: () => ({ homePortal: { ...titles, greeting: '{name}' }, homeLayout: { sectionNames: { latest_events: 'Latest' } }, residentTools: {}, homeFeed: {} }) },
    '@/lib/utils': { endOfThisWeek: now => now }, '@/lib/constants': {}, '@/lib/site-settings': { getSiteSettings: async () => ({}) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: id => {
    if (!(id in modules)) throw new Error(id);
    return modules[id];
  }});
  return exports.default();
}
test('home hides all empty event sections and restores them when matching events appear', async () => {
  const empty = descendants(await home(), node => node.type === 'section').map(node => node.key);
  for (const key of eventKeys) assert.equal(empty.includes(key), false, key);
  const populated = descendants(await home({ populated: true }), node => node.type === 'section').map(node => node.key);
  for (const key of eventKeys) assert.equal(populated.includes(key), true, key);
});
test('RA-hidden sections stay hidden with events; friend cards receive the actual friend profile', async () => {
  const tree = await home({ populated: true, hidden: ['week_events'] });
  assert.equal(descendants(tree, node => node.type === 'section' && node.key === 'week_events').length, 0);
  const section = descendants(tree, node => node.type === 'section' && node.key === 'friends_events')[0];
  const scroller = descendants(section, node => Boolean(node.props?.friendsByEventId))[0];
  const friend = scroller.props.friendsByEventId.get('event-1')[0];
  assert.equal(friend.id, 'friend-1');
  assert.equal(friend.full_name, 'Friend One');
  assert.equal(friend.avatar_url, '/friend.png');
});
