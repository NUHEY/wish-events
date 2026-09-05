const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, process, console, URL,
    require(name) {
      assert.ok(name in mocks, `Unmocked dependency: ${name}`);
      return mocks[name];
    },
  }, { filename });
  return exports;
}

function response(type, destination) {
  const saved = [];
  return { type, destination: destination?.toString(), cookies: { set: (...args) => saved.push(args), getAll: () => saved } };
}
const NextResponse = { next: () => response('next'), redirect: url => response('redirect', url) };

function middleware(user = null) {
  return load('src/lib/supabase/middleware.ts', {
    'next/server': { NextResponse },
    '@/lib/institutional-accounts': { institutionalAccountKindForEmail: () => null },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
  }).updateSession;
}
function request(pathname) {
  const nextUrl = new URL(`https://wish.example${pathname}`);
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, cookies: { getAll: () => [], set() {} } };
}

test('institutional login endpoint reaches its handler before authentication', async () => {
  assert.equal((await middleware()(request('/api/auth/institutional-login'))).type, 'next');
});
test('institutional login endpoint remains reachable for an existing session', async () => {
  const result = await middleware({ email: 'resident@waseda.jp' })(request('/api/auth/institutional-login'));
  assert.equal(result.type, 'next');
});
test('public routes are exact and do not open similarly named protected routes', async () => {
  for (const route of ['/dashboard', '/login-admin', '/auth/callback/private', '/api/auth/institutional-login/private']) {
    assert.equal((await middleware()(request(route))).destination, 'https://wish.example/login');
  }
});
test('login and OAuth callback remain public', async () => {
  for (const route of ['/login', '/auth/callback']) assert.equal((await middleware()(request(route))).type, 'next');
});

function callback(role = 'resident', error = null) {
  return load('src/app/auth/callback/route.ts', {
    'next/server': { NextResponse },
    '@/lib/auth': { postLoginPath: value => value === 'ra' ? '/dashboard' : '/' },
    '@/lib/institutional-accounts': { institutionalAccountKindForEmail: () => null },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: {
        exchangeCodeForSession: async () => ({ error }),
        getUser: async () => ({ data: { user: { id: 'test', email: 'resident@waseda.jp' } } }),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
        role, account_kind: 'resident', full_name: 'Test', student_id: '12345678', floor_number: 3, room_number: '01', wish_entry_month: '2026-04',
      } }) }) }) }),
    }) },
  }).GET;
}
function callbackRequest(next) {
  const url = new URL('https://wish.example/auth/callback?code=test-code');
  if (next != null) url.searchParams.set('next', next);
  return { url: url.href };
}
test('callback rejects external, credential, backslash and control-character destinations', async () => {
  for (const next of ['@attacker.example', '.attacker.example', '//attacker.example', '/\\attacker.example', 'https://attacker.example', '/\n/attacker.example', 'events/123']) {
    const result = await callback('ra')(callbackRequest(next));
    assert.equal(result.destination, 'https://wish.example/dashboard', next);
  }
});
test('callback preserves an internal event invitation including query and hash', async () => {
  const result = await callback()(callbackRequest('/events/123?invited=1#details'));
  assert.equal(result.destination, 'https://wish.example/events/123?invited=1#details');
});
test('callback keeps role-aware defaults and handles invalid authorization codes', async () => {
  assert.equal((await callback()(callbackRequest(null))).destination, 'https://wish.example/');
  assert.equal((await callback('ra')(callbackRequest(null))).destination, 'https://wish.example/dashboard');
  assert.equal((await callback('ra', new Error('invalid code'))(callbackRequest('/dashboard'))).destination, 'https://wish.example/login?error=auth_failed');
});
