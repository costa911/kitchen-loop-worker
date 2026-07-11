const PASSPHRASES = [
  { phrase: "GordonRamsayShoutsToGetMoreViews$", label: "Costa", namespace: "costa" },
  { phrase: "TestingKitchenLoopTest1", label: "Friend1", namespace: "Friend1" },
    { phrase: "KitchenLoopTest2", label: "Friend2", namespace: "Friend2" },
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

async function getFile(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kitchen-loop-worker',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json(); // { content, sha, ... }
}

async function putFile(env, content, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kitchen-loop-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: sync data.json via kitchen-loop-api',
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
  return res.json();
}

// GitHub wraps base64 content at 60 chars and may include \r, \n, or spaces — strip all first.
function parseFileContent(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')));
}

// Read data.json and return { allData, sha }.
// allData is always { stockRecipes: [...], namespaces: { [namespace]: {...} } }.
async function readAllData(env) {
  const file = await getFile(env);
  const allData = parseFileContent(file.content);
  return { allData, sha: file.sha };
}

function emptyNamespace() {
  return {
    userRecipes: [],
    overlays: {},
    plan: [],
    planHistory: [],
    shoppingChecked: {},
    lastSeenStockTimestamp: new Date().toISOString(),
  };
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
          lastSeenStockTimestamp: ns.lastSeenStockTimestamp || null,
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

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
