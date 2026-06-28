import { getUserData, upsertUserData } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });

  const url = new URL(req.url);
  const userId = String(url.searchParams.get('userId') || '').trim();

  if (req.method === 'GET') {
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers });
    }
    const data = await getUserData(userId);
    return new Response(JSON.stringify({ userId, data: data || null }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }

    const bodyUserId = String(body?.userId || userId || '').trim();
    if (!bodyUserId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers });
    }

    const { userId: _ignoredUserId, patch, data, ...rest } = body || {};
    const patchPayload = patch && typeof patch === 'object' ? patch : data && typeof data === 'object' ? data : rest;
    const saved = await upsertUserData(bodyUserId, patchPayload || {});

    return new Response(JSON.stringify({ ok: true, userId: bodyUserId, data: saved }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};
