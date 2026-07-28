import { getAuthenticatedUser, getUserData, ownsUserId, upsertUserData } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });

  const authenticatedUser = getAuthenticatedUser(req);
  if (!authenticatedUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const url = new URL(req.url);
  const requestedUserId = String(url.searchParams.get('userId') || '').trim();
  if (requestedUserId && !ownsUserId(authenticatedUser, requestedUserId)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
  }
  const userId = authenticatedUser.id;

  if (req.method === 'GET') {
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

    const bodyUserId = String(body?.userId || '').trim();
    if (bodyUserId && !ownsUserId(authenticatedUser, bodyUserId)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }

    const { userId: _ignoredUserId, patch, data, ...rest } = body || {};
    const patchPayload = patch && typeof patch === 'object' ? patch : data && typeof data === 'object' ? data : rest;
    const saved = await upsertUserData(userId, patchPayload || {});

    return new Response(JSON.stringify({ ok: true, userId, data: saved }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};
