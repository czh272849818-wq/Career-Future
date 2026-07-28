import { getAuthenticatedUser, ownsUserId } from './_shared/auth-store.mjs';
import { readChatState, writeChatState } from './_shared/chat-store.mjs';

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

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get('userId') || '';
    if (requestedUserId && !ownsUserId(authenticatedUser, requestedUserId)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }
    const userId = authenticatedUser.id;

    const state = await readChatState(userId);
    return new Response(JSON.stringify({
      userId,
      sessions: state?.sessions || [],
      currentSessionId: state?.currentSessionId || null,
      updatedAt: state?.updatedAt || null
    }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }

    const requestedUserId = String(body?.userId || '').trim();
    if (requestedUserId && !ownsUserId(authenticatedUser, requestedUserId)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }
    const userId = authenticatedUser.id;

    const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
    const currentSessionId = body?.currentSessionId || null;
    const saved = await writeChatState(userId, sessions, currentSessionId);

    return new Response(JSON.stringify({
      ok: true,
      userId,
      sessions: saved.sessions,
      currentSessionId: saved.currentSessionId
    }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};
