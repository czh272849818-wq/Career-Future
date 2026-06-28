import { readChatState, writeChatState } from './_shared/chat-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || '';
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers });
    }

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

    const userId = String(body?.userId || '').trim();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers });
    }

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
