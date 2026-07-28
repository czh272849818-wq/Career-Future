import { addAssessment, getAuthenticatedUser, ownsUserId } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

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

  let assessment;
  try {
    assessment = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!assessment || !assessment.id) {
    return new Response(JSON.stringify({ error: 'assessment内容缺失' }), { status: 400, headers });
  }

  const saved = await addAssessment(userId, assessment);
  return new Response(JSON.stringify({ ok: true, saved }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
};
