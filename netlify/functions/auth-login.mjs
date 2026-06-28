import { createToken, sanitizeUser, verifyLogin } from './_shared/auth-store.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export default async (req) => {
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

  const { email = '', identifier = '', password = '' } = body || {};
  const loginId = String(identifier || email).trim();
  if (!loginId || !password) {
    return new Response(JSON.stringify({ error: '账号与密码为必填' }), { status: 400, headers });
  }

  const user = await verifyLogin(loginId, password);
  if (!user) {
    return new Response(JSON.stringify({ error: '邮箱或密码错误' }), { status: 401, headers });
  }

  const token = createToken(user);
  const resBody = { token, user: sanitizeUser(user) };
  return new Response(JSON.stringify(resBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};
