const PASSPHRASES = [
  { phrase: "GordonRamsayShoutsToGetMoreViews$", label: "Costa", namespace: "costa" },
  { phrase: "TestingKitchenLoopTest1", label: "Friend1", namespace: "Wife" },
    { phrase: "KitchenLoopTest2", label: "Friend2", namespace: "Rach" },
    { phrase: "MaxlikesPoo!", label: "Friend3", namespace: "Flanka" },
    { phrase: "ZimbabweIsMyH0me", label: "Friend4", namespace: "Hattie" },
    { phrase: "NFT4L|f3", label: "Friend5", namespace: "Gord" },
    { phrase: "TheBrowLine", label: "Friend5", namespace: "Emmy" },
    { phrase: "GhostWriter", label: "Friend5", namespace: "Evtim" }
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Passphrase',
};

function corsResponse(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kitchen-loop-worker',
  };
}

async function getFile(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, { headers: githubHeaders(env) });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const file = await res.json(); // { content, encoding, sha, size, ... }

  // The Contents API only inlines file content up to 1MB; past that it returns
  // encoding: "none" with an empty content field. data.json has grown past that
  // limit, so fall back to the Git Blobs API (good up to 100MB) using the same sha.
  if (file.encoding === 'base64' && file.content) return file;

  const blobUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/git/blobs/${file.sha}`;
  const blobRes = await fetch(blobUrl, { headers: githubHeaders(env) });
  if (!blobRes.ok) throw new Error(`GitHub blob GET failed: ${blobRes.status}`);
  const blob = await blobRes.json(); // { content, encoding, sha, size }
  return { ...file, content: blob.content, encoding: blob.encoding };
}

// Thrown when GitHub rejects a PUT because `sha` is stale — another write landed first.
// Distinct from other failures so callers can choose to retry against fresh state.
class GitHubConflictError extends Error {}

async function putFile(env, content, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore: sync data.json via kitchen-loop-api',
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 409) throw new GitHubConflictError(`GitHub PUT conflict: ${err}`);
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
  return res.json();
}

// GitHub wraps base64 content at 60 chars and may include \r, \n, or spaces — strip all first.
// putFile encodes with btoa(unescape(encodeURIComponent(content))) to handle non-ASCII
// (e.g. the em dash in lunch names) safely; decoding must reverse the exact same steps
// (decodeURIComponent(escape(...))) or every read-modify-write cycle re-mangles any
// multi-byte character further, compounding in size each time it's written back.
function parseFileContent(b64) {
  return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/\s/g, '')))));
}

// Read data.json and return { allData, sha }.
// allData is always { stockRecipes: [...], namespaces: { [namespace]: {...} } }.
async function readAllData(env) {
  const file = await getFile(env);
  const allData = parseFileContent(file.content);
  return { allData, sha: file.sha };
}

// Read-modify-write with retry: two requests (e.g. two logins, or a login racing a
// heartbeat finalize) can both read the same sha, and GitHub only accepts the first PUT —
// the second gets a 409 and, unretried, silently loses whatever it appended in memory.
// Re-reading and re-applying `mutate` against the latest state avoids that lost update.
async function writeWithRetry(env, mutate, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const { allData, sha } = await readAllData(env);
    mutate(allData);
    try {
      await putFile(env, JSON.stringify(allData), sha);
      return allData;
    } catch (e) {
      if (!(e instanceof GitHubConflictError) || i === attempts - 1) throw e;
    }
  }
}

function emptyNamespace() {
  return {
    userRecipes: [],
    overlays: {},
    plan: [],
    planHistory: [],
    shoppingChecked: {},
    customList: emptyCustomList(),
    lastSeenStockTimestamp: new Date().toISOString(),
    lastSeenChangelogVersion: 0,
    activity: { loginHistory: [], sessions: [] },
  };
}

function emptyCustomList() {
  return { recipeIds: [], shoppingChecked: {}, createdAt: null };
}

// Custom-list entries only store recipeId — look up the display name from the same
// sources remergeRecipes() (frontend) treats as authoritative for names: global stock
// recipes and this namespace's own user recipes. Overlays never carry a name override.
function resolveRecipeName(allData, ns, recipeId) {
  const stock = (allData.stockRecipes || []).find(r => r.id === recipeId);
  if (stock) return stock.name;
  const user = (ns.userRecipes || []).find(r => r.id === recipeId);
  return user ? user.name : 'Unknown recipe';
}

// A session with no heartbeat for this long is considered abandoned — the next heartbeat
// (or the next admin analytics read) closes it out using its last known ping, not "now",
// so a tab left open overnight doesn't get credited with a multi-hour session.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function finalizeSession(ns, session) {
  if (!ns.activity) ns.activity = { loginHistory: [], sessions: [] };
  const durationSeconds = Math.max(0, Math.round((session.lastHeartbeat - session.start) / 1000));
  ns.activity.sessions.push({
    start: new Date(session.start).toISOString(),
    end: new Date(session.lastHeartbeat).toISOString(),
    durationSeconds,
  });
}

export default {
  async fetch(request, env) {
    const { method, url } = request;
    const { pathname } = new URL(url);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (pathname === '/auth' && method === 'POST') {
      try {
        const { phrase } = await request.json();
        const match = PASSPHRASES.find(p => p.phrase === phrase);
        if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
        try {
          await writeWithRetry(env, (allData) => {
            const ns = allData.namespaces[match.namespace] || emptyNamespace();
            if (!ns.activity) ns.activity = { loginHistory: [], sessions: [] };
            ns.activity.loginHistory.push(new Date().toISOString());
            allData.namespaces[match.namespace] = ns;
          });
        } catch (_) {
          // Don't fail login just because activity tracking couldn't write.
        }
        return corsResponse(JSON.stringify({ namespace: match.namespace, label: match.label }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: 'Invalid request' }), 400);
      }
    }

    if (pathname === '/data' && method === 'GET') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { allData, sha } = await readAllData(env);
        const isNewNamespace = !(match.namespace in allData.namespaces);

        if (isNewNamespace) {
          allData.namespaces[match.namespace] = emptyNamespace();
          try { await putFile(env, JSON.stringify(allData), sha); } catch (_) {}
        }

        const ns = allData.namespaces[match.namespace];
        return corsResponse(JSON.stringify({
          stockRecipes: allData.stockRecipes || [],
          userRecipes: ns.userRecipes || [],
          overlays: ns.overlays || {},
          plan: ns.plan || [],
          planHistory: ns.planHistory || [],
          shoppingChecked: ns.shoppingChecked || {},
          customList: ns.customList || emptyCustomList(),
          lastSeenStockTimestamp: ns.lastSeenStockTimestamp || null,
          // Missing (predates the field) defaults to 0, same as a brand-new namespace —
          // at this rollout the backlog is exactly the 2 entries everyone should see once.
          lastSeenChangelogVersion: typeof ns.lastSeenChangelogVersion === 'number' ? ns.lastSeenChangelogVersion : 0,
        }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/data' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const body = await request.text();
        const incoming = JSON.parse(body);
        const { allData, sha } = await readAllData(env);

        // Allowlist: only these per-namespace keys are ever written. Notably, any
        // "stockRecipes" the client sends is silently ignored — global stock can only be
        // mutated via PUT /stock, which enforces the admin (costa) check server-side.
        const ns = allData.namespaces[match.namespace] || emptyNamespace();
        if (Array.isArray(incoming.userRecipes)) ns.userRecipes = incoming.userRecipes;
        if (Array.isArray(incoming.plan)) ns.plan = incoming.plan;
        if (Array.isArray(incoming.planHistory)) ns.planHistory = incoming.planHistory;
        if (incoming.overlays && typeof incoming.overlays === 'object' && !Array.isArray(incoming.overlays)) ns.overlays = incoming.overlays;
        if (incoming.shoppingChecked && typeof incoming.shoppingChecked === 'object' && !Array.isArray(incoming.shoppingChecked)) ns.shoppingChecked = incoming.shoppingChecked;
        if (typeof incoming.lastSeenStockTimestamp === 'string') ns.lastSeenStockTimestamp = incoming.lastSeenStockTimestamp;
        allData.namespaces[match.namespace] = ns;

        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/custom-list' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const incoming = JSON.parse(await request.text());
        if (!Array.isArray(incoming.recipeIds)) {
          return corsResponse(JSON.stringify({ error: 'Expected recipeIds array' }), 400);
        }
        const { allData, sha } = await readAllData(env);
        const ns = allData.namespaces[match.namespace] || emptyNamespace();
        const cl = ns.customList || emptyCustomList();
        cl.recipeIds = incoming.recipeIds;
        if (incoming.shoppingChecked && typeof incoming.shoppingChecked === 'object' && !Array.isArray(incoming.shoppingChecked)) {
          cl.shoppingChecked = incoming.shoppingChecked;
        }
        cl.createdAt = cl.recipeIds.length ? (cl.createdAt || new Date().toISOString()) : null;
        ns.customList = cl;
        allData.namespaces[match.namespace] = ns;

        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    // Freezes recipeIds into named entries (so History still reads fine after a recipe is
    // renamed or removed later) and files them into the same planHistory array the
    // fortnightly plan archives into, tagged so the frontend can render them differently.
    if (pathname === '/custom-list/archive' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { allData, sha } = await readAllData(env);
        const ns = allData.namespaces[match.namespace] || emptyNamespace();
        const cl = ns.customList || emptyCustomList();
        if (!cl.recipeIds.length) {
          return corsResponse(JSON.stringify({ error: 'No active custom list to archive' }), 400);
        }
        const entries = cl.recipeIds.map(id => ({ recipeId: id, recipeName: resolveRecipeName(allData, ns, id) }));
        const savedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const entry = { type: 'custom', savedAt, entries };
        if (!ns.planHistory) ns.planHistory = [];
        ns.planHistory.unshift(entry);
        ns.customList = emptyCustomList();
        allData.namespaces[match.namespace] = ns;

        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true, entry }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/custom-list/clear' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { allData, sha } = await readAllData(env);
        const ns = allData.namespaces[match.namespace] || emptyNamespace();
        ns.customList = emptyCustomList();
        allData.namespaces[match.namespace] = ns;

        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/changelog-seen' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { version } = JSON.parse(await request.text());
        if (!Number.isInteger(version)) {
          return corsResponse(JSON.stringify({ error: 'Expected integer version' }), 400);
        }
        const { allData, sha } = await readAllData(env);
        const ns = allData.namespaces[match.namespace] || emptyNamespace();
        // Max, not overwrite — an out-of-order request (e.g. a stale tab) should never
        // walk lastSeenChangelogVersion backwards and resurrect an already-dismissed popup.
        ns.lastSeenChangelogVersion = Math.max(ns.lastSeenChangelogVersion || 0, version);
        allData.namespaces[match.namespace] = ns;

        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    // Buffers session heartbeats in KV instead of writing data.json on every ping (which
    // arrives ~every 60s from every active tab). A GitHub commit only happens when a
    // *previous* session is discovered to have gone idle — so in steady state this costs
    // one cheap KV write per ping and roughly one GitHub commit per session, not per ping.
    if (pathname === '/heartbeat' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const now = Date.now();
        const kvKey = `session:${match.namespace}`;
        const existingRaw = await env.HEARTBEAT_KV.get(kvKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;

        if (existing && (now - existing.lastHeartbeat) < IDLE_TIMEOUT_MS) {
          existing.lastHeartbeat = now;
          await env.HEARTBEAT_KV.put(kvKey, JSON.stringify(existing));
          return corsResponse(JSON.stringify({ ok: true }));
        }

        // No session in KV, or the previous one has been idle 5+ minutes: close out the
        // stale one (if any) using its last known ping as the end time, then start fresh.
        if (existing) {
          const { allData, sha } = await readAllData(env);
          const ns = allData.namespaces[match.namespace] || emptyNamespace();
          finalizeSession(ns, existing);
          allData.namespaces[match.namespace] = ns;
          await putFile(env, JSON.stringify(allData), sha);
        }

        await env.HEARTBEAT_KV.put(kvKey, JSON.stringify({ start: now, lastHeartbeat: now }));
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/link-click' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { recipeId, recipeName, link } = await request.json();
        await writeWithRetry(env, (allData) => {
          const ns = allData.namespaces[match.namespace] || emptyNamespace();
          if (!ns.activity) ns.activity = { loginHistory: [], sessions: [] };
          if (!ns.activity.linkClicks) ns.activity.linkClicks = [];
          ns.activity.linkClicks.push({ recipeId, recipeName, link, timestamp: new Date().toISOString() });
          allData.namespaces[match.namespace] = ns;
        });
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/stock' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      if (match.namespace !== 'costa') return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403);
      try {
        const body = await request.text();
        const stock = JSON.parse(body);
        if (!Array.isArray(stock)) {
          return corsResponse(JSON.stringify({ error: 'Expected stockRecipes array' }), 400);
        }
        const seenIds = new Set();
        for (const r of stock) {
          if (!r || typeof r.id !== 'string' || !/^stock-\d+$/.test(r.id)) {
            return corsResponse(JSON.stringify({ error: `Invalid stock recipe id: ${r && r.id}` }), 400);
          }
          if (!r.name || !r.ingredients) {
            return corsResponse(JSON.stringify({ error: `Recipe ${r.id} missing name or ingredients` }), 400);
          }
          if (seenIds.has(r.id)) {
            return corsResponse(JSON.stringify({ error: `Duplicate stock recipe id: ${r.id}` }), 400);
          }
          seenIds.add(r.id);
        }

        const { allData, sha } = await readAllData(env);
        allData.stockRecipes = stock;
        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/admin/analytics' && method === 'GET') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      if (match.namespace !== 'costa') return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403);
      try {
        const now = Date.now();
        const { allData, sha } = await readAllData(env);
        const liveSessions = {};
        let dirty = false;

        for (const nsName of Object.keys(allData.namespaces)) {
          const kvKey = `session:${nsName}`;
          const raw = await env.HEARTBEAT_KV.get(kvKey);
          if (!raw) continue;
          const session = JSON.parse(raw);
          if (now - session.lastHeartbeat >= IDLE_TIMEOUT_MS) {
            finalizeSession(allData.namespaces[nsName], session);
            dirty = true;
            await env.HEARTBEAT_KV.delete(kvKey);
          } else {
            liveSessions[nsName] = session;
          }
        }

        if (dirty) await putFile(env, JSON.stringify(allData), sha);

        const analytics = {};
        for (const [nsName, nsData] of Object.entries(allData.namespaces)) {
          const activity = nsData.activity || { loginHistory: [], sessions: [] };
          const sessions = activity.sessions || [];
          const live = liveSessions[nsName];

          let totalSessionTime = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
          let sessionCount = sessions.length;
          let lastActiveMs = 0;
          for (const t of activity.loginHistory || []) lastActiveMs = Math.max(lastActiveMs, new Date(t).getTime());
          for (const s of sessions) lastActiveMs = Math.max(lastActiveMs, new Date(s.end).getTime());

          if (live) {
            totalSessionTime += Math.max(0, Math.round((live.lastHeartbeat - live.start) / 1000));
            sessionCount += 1;
            lastActiveMs = Math.max(lastActiveMs, live.lastHeartbeat);
          }

          let totalCooksLogged = 0;
          for (const r of nsData.userRecipes || []) totalCooksLogged += (r.cookDates || []).length;
          for (const ov of Object.values(nsData.overlays || {})) totalCooksLogged += (ov.cookDates || []).length;

          analytics[nsName] = {
            totalLogins: (activity.loginHistory || []).length,
            lastActive: lastActiveMs ? new Date(lastActiveMs).toISOString() : null,
            totalSessionTime,
            avgSessionLength: sessionCount ? Math.round(totalSessionTime / sessionCount) : 0,
            recipesAdded: (nsData.userRecipes || []).length,
            totalCooksLogged,
            linkClicks: (activity.linkClicks || []).length,
            linkClickDetail: activity.linkClicks || [],
          };
        }

        return corsResponse(JSON.stringify(analytics));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
