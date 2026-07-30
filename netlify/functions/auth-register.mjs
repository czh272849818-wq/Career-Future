import { createToken, createUser, sanitizeUser } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { email = '', password = '', name = '', phone = '' } = body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return new Response(JSON.stringify({ error: '邮箱与密码为必填' }), { status: 400, headers });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return new Response(JSON.stringify({ error: '请输入有效邮箱地址' }), { status: 400, headers });
  }
  if (String(password).length < 8 || String(password).length > 128) {
    return new Response(JSON.stringify({ error: '密码至少需要 8 位' }), { status: 400, headers });
  }

  try {
    const user = await createUser({ email: normalizedEmail, password, name, phone });
    const token = createToken(user);
    const resBody = { token, user: sanitizeUser(user) };
    return new Response(JSON.stringify(resBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    if (String(err?.message) === 'EMAIL_EXISTS') return new Response(JSON.stringify({ error: '邮箱已注册' }), { status: 409, headers });
    if (String(err?.message) === 'PHONE_EXISTS') return new Response(JSON.stringify({ error: '手机号已注册' }), { status: 409, headers });
    console.error('[auth-register] error:', err);
    return new Response(JSON.stringify({ error: '注册失败' }), { status: 500, headers });
  }
};
