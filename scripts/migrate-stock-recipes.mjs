#!/usr/bin/env node
// One-off migration: split each namespace's duplicated 51-seed-recipe copies into a single
// global `stockRecipes` array plus lightweight per-namespace `overlays` (cookDates/personalNotes).
// Run: node migrate-stock-recipes.mjs <input.json> <output.json>
// Never overwrites the input; always writes to a separate output path.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node migrate-stock-recipes.mjs <input.json> <output.json>');
  process.exit(1);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8'));

if (input.stockRecipes !== undefined) {
  console.error('Input already has a top-level "stockRecipes" key — refusing to double-migrate.');
  process.exit(1);
}

if (!input.costa || !Array.isArray(input.costa.recipes)) {
  console.error('Expected input.costa.recipes to exist (costa is the canonical stock source).');
  process.exit(1);
}

const MIGRATION_TS = new Date().toISOString();

const isSeedId = (id) => Number.isInteger(id) && id >= 1 && id <= 51;

// ---- Build canonical stockRecipes from costa's copy ----
const stockRecipes = input.costa.recipes
  .filter((r) => isSeedId(r.id))
  .map((r) => ({
    id: `stock-${r.id}`,
    name: r.name,
    tags: r.tags,
    ingredients: r.ingredients,
    notes: r.notes || '',
    link: r.link || '',
    pairsWith: r.pairsWith || '',
    isStock: true,
    addedDate: MIGRATION_TS,
    socialLink: null,
  }));

const stockIdByOldId = new Map(stockRecipes.map((s) => [Number(s.id.split('-')[1]), s.id]));
const stockById = new Map(stockRecipes.map((s) => [s.id, s]));

function remapId(id) {
  return typeof id === 'number' && isSeedId(id) ? `stock-${id}` : id;
}

function remapPlanEntries(entries) {
  let remapped = 0;
  for (const p of entries || []) {
    if (typeof p.recipeId === 'number' && isSeedId(p.recipeId)) { p.recipeId = remapId(p.recipeId); remapped++; }
    if (typeof p.sideId === 'number' && isSeedId(p.sideId)) { p.sideId = remapId(p.sideId); remapped++; }
  }
  return remapped;
}

// ---- Per-namespace transform ----
const namespaces = {};
const report = { namespaces: {} };

for (const ns of Object.keys(input)) {
  const nsData = input[ns];
  const recipes = nsData.recipes || [];

  const seedRecipes = recipes.filter((r) => isSeedId(r.id));
  const userRecipes = recipes
    .filter((r) => !isSeedId(r.id))
    .map(({ proteinCategory, ...rest }) => rest); // drop client-memoized derived field, not real schema

  const overlays = {};
  let cookDatesTotal = 0;
  for (const r of seedRecipes) {
    const stockId = stockIdByOldId.get(r.id);
    const canonical = stockById.get(stockId);
    const ov = {};
    if (r.cookDates && r.cookDates.length) { ov.cookDates = r.cookDates; cookDatesTotal += r.cookDates.length; }
    if ((r.notes || '').trim() !== (canonical.notes || '').trim()) ov.personalNotes = r.notes;
    if (Object.keys(ov).length) overlays[stockId] = ov;
  }

  const plan = nsData.plan || [];
  const planHistory = nsData.planHistory || [];
  let remappedCount = remapPlanEntries(plan);
  for (const entry of planHistory) remappedCount += remapPlanEntries(entry.entries);

  namespaces[ns] = {
    userRecipes,
    overlays,
    plan,
    planHistory,
    shoppingChecked: nsData.shoppingChecked || {},
    lastSeenStockTimestamp: MIGRATION_TS,
  };

  report.namespaces[ns] = {
    seedRecipeCount: seedRecipes.length,
    userRecipeCount: userRecipes.length,
    overlayCount: Object.keys(overlays).length,
    cookDatesTotal,
    remappedPlanIds: remappedCount,
    shoppingCheckedKeys: Object.keys(nsData.shoppingChecked || {}).length,
  };
}

const output = { stockRecipes, namespaces };

// ---- Verification ----
let ok = true;
function check(label, cond) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) ok = false;
}

check('stockRecipes has 51 entries', stockRecipes.length === 51);
const ids = stockRecipes.map((s) => s.id);
check('stockRecipes ids unique', new Set(ids).size === ids.length);
check('stockRecipes ids match stock-1..stock-51', ids.every((id, i) => id === `stock-${i + 1}`));

for (const ns of Object.keys(input)) {
  const origNonSeedCount = (input[ns].recipes || []).filter((r) => !isSeedId(r.id)).length;
  check(`${ns}: userRecipes count matches original non-seed count (${origNonSeedCount})`, namespaces[ns].userRecipes.length === origNonSeedCount);

  const origCookDatesTotal = (input[ns].recipes || [])
    .filter((r) => isSeedId(r.id))
    .reduce((sum, r) => sum + (r.cookDates ? r.cookDates.length : 0), 0);
  check(`${ns}: no cookDates lost (${origCookDatesTotal})`, report.namespaces[ns].cookDatesTotal === origCookDatesTotal);

  const origShoppingKeys = Object.keys(input[ns].shoppingChecked || {});
  const newShoppingKeys = Object.keys(namespaces[ns].shoppingChecked);
  check(`${ns}: shoppingChecked unchanged (${origShoppingKeys.length} keys)`,
    JSON.stringify(input[ns].shoppingChecked || {}) === JSON.stringify(namespaces[ns].shoppingChecked));
}

console.log('\n--- Per-namespace report ---');
console.table(report.namespaces);

console.log('\n--- Sample: namespaces.costa (truncated) ---');
const sample = {
  userRecipes: namespaces.costa.userRecipes.slice(0, 2),
  overlays: Object.fromEntries(Object.entries(namespaces.costa.overlays).slice(0, 5)),
  lastSeenStockTimestamp: namespaces.costa.lastSeenStockTimestamp,
  planFirst2: namespaces.costa.plan.slice(0, 2),
};
console.log(JSON.stringify(sample, null, 2));

console.log('\n--- Sample: first 2 stockRecipes ---');
console.log(JSON.stringify(stockRecipes.slice(0, 2), null, 2));

if (!ok) {
  console.error('\nVerification FAILED — not writing output.');
  process.exit(1);
}

writeFileSync(outputPath, JSON.stringify(output));
console.log(`\nVerification passed. Wrote ${outputPath}`);
