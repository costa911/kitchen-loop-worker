const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PIN',
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

export default {
  async fetch(request, env) {
    const { method, url } = request;
    const { pathname } = new URL(url);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (pathname === '/data' && method === 'GET') {
      try {
        const file = await getFile(env);
        const data = JSON.parse(atob(file.content.replace(/\n/g, '')));
        return corsResponse(JSON.stringify(data));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/data' && method === 'PUT') {
      const pin = request.headers.get('X-PIN');
      if (!pin || pin !== env.APP_PIN) {
        return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      }
      try {
        const body = await request.text();
        JSON.parse(body); // validate JSON before writing
        const file = await getFile(env);
        await putFile(env, body, file.sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
