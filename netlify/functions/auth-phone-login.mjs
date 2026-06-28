import { loginOrCreatePhoneUser, normalizePhone, sanitizeUser, createToken } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const phone = normalizePhone(body?.phone || '');
  const code = String(body?.code || '').trim();
  try {
    const user = await loginOrCreatePhoneUser({ phone, code, name: body?.name || '' });
    const token = createToken(user);
    return new Response(JSON.stringify({ token, user: sanitizeUser(user) }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (String(err?.message) === 'INVALID_CODE') {
      return new Response(JSON.stringify({ error: '验证码错误或已过期' }), { status: 401, headers });
    }
    console.error('[auth-phone-login] error:', err);
    return new Response(JSON.stringify({ error: '手机号登录失败' }), { status: 500, headers });
  }
};
