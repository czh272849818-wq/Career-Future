import { addAssessment } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const url = new URL(req.url);
  const userId = String(url.searchParams.get('userId') || '').trim();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers });
  }

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
