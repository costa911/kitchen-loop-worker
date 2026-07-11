#!/usr/bin/env node
// Throwaway offline verification harness — no real network calls, no test framework dependency.
// Mocks the GitHub Contents API so the worker's fetch handler can be exercised end-to-end.
// Run: node scripts/test-worker-offline.mjs

import worker from '../src/index.js';
import { readFileSync } from 'node:fs';

const FIXTURE_PATH = process.argv[2] || new URL('../../the-kitchen-loop/data.json', import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

let currentFile = structuredClone(fixture);
let currentSha = 'sha-0';
let writeCount = 0;
let lastWrittenBody = null;

function createMockKv() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    _store: store,
  };
}

const env = { GITHUB_REPO: 'test/test', GITHUB_FILE: 'data.json', GITHUB_TOKEN: 'fake-token', HEARTBEAT_KV: createMockKv() };

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const urlStr = String(url);
  if (!urlStr.startsWith('https://api.github.com/repos/test/test/contents/data.json')) {
    throw new Error(`Unexpected fetch to ${urlStr} — mock only handles the GitHub contents endpoint`);
  }
  if (!opts.method || opts.method === 'GET') {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(currentFile))));
    return new Response(JSON.stringify({ content, sha: currentSha }), { status: 200 });
  }
  if (opts.method === 'PUT') {
    const body = JSON.parse(opts.body);
    currentFile = JSON.parse(decodeURIComponent(escape(atob(body.content))));
    currentSha = `sha-${++writeCount}`;
    lastWrittenBody = currentFile;
    return new Response(JSON.stringify({ content: { sha: currentSha } }), { status: 200 });
  }
  throw new Error(`Unexpected method ${opts.method}`);
};

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
}

function req(pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`https://worker.test${pathname}`, { method, headers, body });
}

async function run() {
  // ---- POST /auth ----
  {
    const res = await worker.fetch(req('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase: 'GordonRamsayShoutsToGetMoreViews$' }) }), env);
    const json = await res.json();
    check('auth: costa passphrase -> 200 + namespace=costa', res.status === 200 && json.namespace === 'costa');
  }
  {
    const res = await worker.fetch(req('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase: 'TestingKitchenLoopTest1' }) }), env);
    const json = await res.json();
    check('auth: Friend1 passphrase -> 200 + namespace=Friend1', res.status === 200 && json.namespace === 'Friend1');
  }
  {
    const res = await worker.fetch(req('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase: 'KitchenLoopTest2' }) }), env);
    const json = await res.json();
    check('auth: Friend2 passphrase -> 200 + namespace=Friend2', res.status === 200 && json.namespace === 'Friend2');
  }
  {
    const res = await worker.fetch(req('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase: 'nope' }) }), env);
    check('auth: bad passphrase -> 401', res.status === 401);
  }

  // ---- GET /data ----
  let costaData, friend1Data, friend2Data;
  {
    const res = await worker.fetch(req('/data', { headers: { 'X-Passphrase': 'GordonRamsayShoutsToGetMoreViews$' } }), env);
    costaData = await res.json();
    check('GET /data costa: 200', res.status === 200);
    check('GET /data costa: has all expected keys', ['stockRecipes','userRecipes','overlays','plan','planHistory','shoppingChecked','lastSeenStockTimestamp'].every(k => k in costaData));
    check('GET /data costa: stockRecipes has 51 entries', costaData.stockRecipes.length === 51);
    check('GET /data costa: userRecipes has BBQ Ribs', costaData.userRecipes.some(r => r.name === 'BBQ Ribs'));
    check('GET /data costa: overlays present', Object.keys(costaData.overlays).length > 0);
  }
  {
    const res = await worker.fetch(req('/data', { headers: { 'X-Passphrase': 'TestingKitchenLoopTest1' } }), env);
    friend1Data = await res.json();
    check('GET /data Friend1: 200', res.status === 200);
    check('GET /data Friend1: stockRecipes identical to costa\'s', JSON.stringify(friend1Data.stockRecipes) === JSON.stringify(costaData.stockRecipes));
    check('GET /data Friend1: userRecipes is namespace-specific (empty)', friend1Data.userRecipes.length === 0);
  }
  {
    const res = await worker.fetch(req('/data', { headers: { 'X-Passphrase': 'KitchenLoopTest2' } }), env);
    friend2Data = await res.json();
    check('GET /data Friend2: 200', res.status === 200);
    check('GET /data Friend2: stockRecipes identical to costa\'s', JSON.stringify(friend2Data.stockRecipes) === JSON.stringify(costaData.stockRecipes));
  }
  {
    const res = await worker.fetch(req('/data', { headers: { 'X-Passphrase': 'nope' } }), env);
    check('GET /data: bad passphrase -> 401', res.status === 401);
  }

  // ---- PUT /data with a bogus stockRecipes key (must be silently dropped) ----
  {
    const beforeStock = JSON.stringify(currentFile.stockRecipes);
    const payload = {
      userRecipes: friend1Data.userRecipes,
      overlays: friend1Data.overlays,
      plan: friend1Data.plan,
      planHistory: friend1Data.planHistory,
      shoppingChecked: friend1Data.shoppingChecked,
      lastSeenStockTimestamp: friend1Data.lastSeenStockTimestamp,
      stockRecipes: [{ id: 'stock-1', name: 'HACKED', ingredients: 'x' }], // should be ignored
    };
    const res = await worker.fetch(req('/data', { method: 'PUT', headers: { 'X-Passphrase': 'TestingKitchenLoopTest1', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), env);
    check('PUT /data Friend1: 200', res.status === 200);
    check('PUT /data: bogus stockRecipes key ignored, global stock unchanged', JSON.stringify(currentFile.stockRecipes) === beforeStock);
    check('PUT /data: Friend1 namespace actually written', currentFile.namespaces.Friend1.userRecipes.length === friend1Data.userRecipes.length);
  }

  // ---- PUT /stock ----
  {
    const newStock = costaData.stockRecipes.map(r => r.id === 'stock-1' ? { ...r, name: 'Chicken Pho (edited)' } : r);
    const res = await worker.fetch(req('/stock', { method: 'PUT', headers: { 'X-Passphrase': 'GordonRamsayShoutsToGetMoreViews$', 'Content-Type': 'application/json' }, body: JSON.stringify(newStock) }), env);
    check('PUT /stock as costa: 200', res.status === 200);
    check('PUT /stock as costa: change persisted', currentFile.stockRecipes.find(r => r.id === 'stock-1').name === 'Chicken Pho (edited)');
  }
  {
    const res = await worker.fetch(req('/stock', { method: 'PUT', headers: { 'X-Passphrase': 'TestingKitchenLoopTest1', 'Content-Type': 'application/json' }, body: JSON.stringify(costaData.stockRecipes) }), env);
    check('PUT /stock as Friend1 (non-admin): 403', res.status === 403);
  }
  {
    const badStock = [{ id: 'not-a-valid-id', name: 'X', ingredients: 'Y' }];
    const res = await worker.fetch(req('/stock', { method: 'PUT', headers: { 'X-Passphrase': 'GordonRamsayShoutsToGetMoreViews$', 'Content-Type': 'application/json' }, body: JSON.stringify(badStock) }), env);
    check('PUT /stock malformed id: 400', res.status === 400);
  }
  {
    const dupeStock = [
      { id: 'stock-1', name: 'A', ingredients: 'x' },
      { id: 'stock-1', name: 'B', ingredients: 'y' },
    ];
    const res = await worker.fetch(req('/stock', { method: 'PUT', headers: { 'X-Passphrase': 'GordonRamsayShoutsToGetMoreViews$', 'Content-Type': 'application/json' }, body: JSON.stringify(dupeStock) }), env);
    check('PUT /stock duplicate id: 400', res.status === 400);
  }

  // ---- POST /auth: login history tracking ----
  {
    const before = currentFile.namespaces.costa.activity.loginHistory.length;
    const res = await worker.fetch(req('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase: 'GordonRamsayShoutsToGetMoreViews$' }) }), env);
    check('auth: costa login -> 200', res.status === 200);
    check('auth: costa loginHistory grew by 1', currentFile.namespaces.costa.activity.loginHistory.length === before + 1);
  }

  // ---- PUT /heartbeat + GET /admin/analytics ----
  const kv = env.HEARTBEAT_KV;
  const COSTA = 'GordonRamsayShoutsToGetMoreViews$';
  const FRIEND1 = 'TestingKitchenLoopTest1';

  {
    const writesBefore = writeCount;
    const res = await worker.fetch(req('/heartbeat', { method: 'PUT', headers: { 'X-Passphrase': COSTA } }), env);
    check('PUT /heartbeat costa (first ping): 200', res.status === 200);
    check('PUT /heartbeat: first ping only touches KV, no GitHub write', writeCount === writesBefore);
    check('PUT /heartbeat: KV session created for costa', !!(await kv.get('session:costa')));
  }
  {
    const writesBefore = writeCount;
    const res = await worker.fetch(req('/heartbeat', { method: 'PUT', headers: { 'X-Passphrase': COSTA } }), env);
    check('PUT /heartbeat costa (second ping, still live): 200', res.status === 200);
    check('PUT /heartbeat: live ping still no GitHub write', writeCount === writesBefore);
  }
  {
    const res = await worker.fetch(req('/heartbeat', { method: 'PUT', headers: { 'X-Passphrase': 'nope' } }), env);
    check('PUT /heartbeat: bad passphrase -> 401', res.status === 401);
  }
  {
    // Simulate the costa session having gone idle for 6 minutes (past the 5-min timeout),
    // with the tab having been open for 3 minutes before it stopped pinging.
    const staleLastBeat = Date.now() - 6 * 60 * 1000;
    const staleStart = staleLastBeat - 3 * 60 * 1000;
    kv._store.set('session:costa', JSON.stringify({ start: staleStart, lastHeartbeat: staleLastBeat }));

    const writesBefore = writeCount;
    const sessionsBefore = currentFile.namespaces.costa.activity.sessions.length;
    const res = await worker.fetch(req('/heartbeat', { method: 'PUT', headers: { 'X-Passphrase': COSTA } }), env);
    check('PUT /heartbeat costa (after idle gap): 200', res.status === 200);
    check('PUT /heartbeat: idle session finalized via exactly one GitHub write', writeCount === writesBefore + 1);
    check('PUT /heartbeat: costa activity.sessions grew by 1', currentFile.namespaces.costa.activity.sessions.length === sessionsBefore + 1);
    const finalized = currentFile.namespaces.costa.activity.sessions.at(-1);
    check('PUT /heartbeat: finalized session end uses last heartbeat, not now', finalized.end === new Date(staleLastBeat).toISOString());
    check('PUT /heartbeat: finalized session duration ~180s (not the 6+ min idle gap)', Math.abs(finalized.durationSeconds - 180) <= 2);
    const fresh = JSON.parse(await kv.get('session:costa'));
    check('PUT /heartbeat: fresh KV session started after finalize', fresh.start === fresh.lastHeartbeat);
  }
  {
    // Friend1 pings once and stays "live" — should surface as an in-progress session in
    // analytics without requiring a GitHub write. Friend2 never pings at all.
    const res = await worker.fetch(req('/heartbeat', { method: 'PUT', headers: { 'X-Passphrase': FRIEND1 } }), env);
    check('PUT /heartbeat Friend1 (live session): 200', res.status === 200);
  }

  {
    const res = await worker.fetch(req('/admin/analytics', { headers: { 'X-Passphrase': 'nope' } }), env);
    check('GET /admin/analytics: bad passphrase -> 401', res.status === 401);
  }
  {
    const res = await worker.fetch(req('/admin/analytics', { headers: { 'X-Passphrase': FRIEND1 } }), env);
    check('GET /admin/analytics: non-admin -> 403', res.status === 403);
  }
  {
    const res = await worker.fetch(req('/admin/analytics', { headers: { 'X-Passphrase': COSTA } }), env);
    check('GET /admin/analytics: 200', res.status === 200);
    const analytics = await res.json();
    check('GET /admin/analytics: includes all 3 namespaces', ['costa', 'Friend1', 'Friend2'].every(n => n in analytics));
    check('GET /admin/analytics: costa totalLogins > 0', analytics.costa.totalLogins > 0);
    check('GET /admin/analytics: costa totalSessionTime includes finalized ~180s session', analytics.costa.totalSessionTime >= 180);
    check('GET /admin/analytics: Friend1 shows a live in-progress session (still in KV)', analytics.Friend1.totalSessionTime >= 0 && !!(await kv.get('session:Friend1')));
    check('GET /admin/analytics: Friend2 has zero session time (never pinged)', analytics.Friend2.totalSessionTime === 0 && analytics.Friend2.avgSessionLength === 0);
    check('GET /admin/analytics: costa recipesAdded matches userRecipes.length', analytics.costa.recipesAdded === currentFile.namespaces.costa.userRecipes.length);
    const expectedCooks = currentFile.namespaces.costa.userRecipes.reduce((a, r) => a + (r.cookDates || []).length, 0)
      + Object.values(currentFile.namespaces.costa.overlays).reduce((a, ov) => a + (ov.cookDates || []).length, 0);
    check('GET /admin/analytics: costa totalCooksLogged matches userRecipes+overlays cookDates', analytics.costa.totalCooksLogged === expectedCooks);
  }
  {
    // A stale session that nobody ever pings again should still get finalized and folded
    // into the report the next time an admin reads /admin/analytics.
    const staleLastBeat = Date.now() - 10 * 60 * 1000;
    const staleStart = staleLastBeat - 2 * 60 * 1000;
    kv._store.set('session:Friend1', JSON.stringify({ start: staleStart, lastHeartbeat: staleLastBeat }));

    const writesBefore = writeCount;
    const res = await worker.fetch(req('/admin/analytics', { headers: { 'X-Passphrase': COSTA } }), env);
    const analytics = await res.json();
    check('GET /admin/analytics: lazily finalizes a stale Friend1 session', writeCount === writesBefore + 1);
    check('GET /admin/analytics: Friend1 stale session cleared from KV', !(await kv.get('session:Friend1')));
    check('GET /admin/analytics: Friend1 totalSessionTime now includes the ~120s finalized session', analytics.Friend1.totalSessionTime >= 120);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  globalThis.fetch = realFetch;
  process.exit(failures === 0 ? 0 : 1);
}

run();
