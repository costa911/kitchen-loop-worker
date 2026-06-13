const PASSPHRASES = [
  { phrase: "GordonRamsayShoutsToGetMoreViews$", label: "Costa", namespace: "costa" },
  { phrase: "TestingKitchenLoopTest1", label: "Friend1", namespace: "Friend1" },
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

// Read data.json and return { raw, allData, sha }.
// allData is always in namespaced form { "costa": {...}, ... }.
// If the file is in the old flat format (has "recipes" at root), it wraps it under "costa".
async function readAllData(env) {
  const file = await getFile(env);
  const raw = parseFileContent(file.content);
  const allData = raw.recipes !== undefined ? { costa: raw } : { ...raw };
  return { allData, sha: file.sha, wasLegacy: raw.recipes !== undefined };
}

function emptyNamespace() {
  return { recipes: [], plan: [], planHistory: [], shoppingChecked: {} };
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
        const { allData, sha, wasLegacy } = await readAllData(env);
        const isNewUser = !(match.namespace in allData);

        // Seed empty namespace for a first-time user
        if (isNewUser) {
          allData[match.namespace] = emptyNamespace();
        }

        // Write back if we migrated legacy flat data or seeded a new namespace
        if (wasLegacy || isNewUser) {
          try { await putFile(env, JSON.stringify(allData), sha); } catch (_) {}
        }

        return corsResponse(JSON.stringify(allData[match.namespace]));
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
        JSON.parse(body); // validate JSON before writing
        const { allData, sha } = await readAllData(env);
        allData[match.namespace] = JSON.parse(body);
        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
