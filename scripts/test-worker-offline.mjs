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

const env = { GITHUB_REPO: 'test/test', GITHUB_FILE: 'data.json', GITHUB_TOKEN: 'fake-token' };

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

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  globalThis.fetch = realFetch;
  process.exit(failures === 0 ? 0 : 1);
}

run();
