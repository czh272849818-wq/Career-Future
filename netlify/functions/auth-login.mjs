import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const DB_PATH = path.join('/tmp', 'netlify-auth-db.json');

function readDB() {
  try {
    const txt = fs.readFileSync(DB_PATH, 'utf-8');
    const obj = JSON.parse(txt);
    if (!obj.users || !obj.emailIndex) return { users: {}, emailIndex: {}, phoneIndex: {}, wechatIndex: {}, phoneCodes: {}, data: {} };
    obj.phoneIndex = obj.phoneIndex || {};
    obj.wechatIndex = obj.wechatIndex || {};
    obj.phoneCodes = obj.phoneCodes || {};
    obj.data = obj.data || {};
    return obj;
  } catch {
    return { users: {}, emailIndex: {}, phoneIndex: {}, wechatIndex: {}, phoneCodes: {}, data: {} };
  }
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + ':' + String(salt)).digest('hex');
}

function normalizePhone(phone = '') {
  const digits = String(phone).trim().replace(/[^\d+]/g, '');
  if (/^\+86\d{11}$/.test(digits)) return digits;
  if (/^86\d{11}$/.test(digits)) return `+${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+86${digits}`;
  return digits;
}

function sanitizeUser(user) {
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

function createToken(user) {
  const secret = process.env.AUTH_SECRET || 'dev-secret';
  const payload = JSON.stringify({ id: user.id, ts: Date.now() });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

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

  const db = readDB();
  const id = loginId.includes('@') ? db.emailIndex[loginId.toLowerCase()] : db.phoneIndex[normalizePhone(loginId)];
  if (!id) {
    return new Response(JSON.stringify({ error: '用户不存在' }), { status: 404, headers });
  }
  const user = db.users[id];
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return new Response(JSON.stringify({ error: '密码错误' }), { status: 401, headers });
  }

  const token = createToken(user);
  const resBody = { token, user: sanitizeUser(user) };
  return new Response(JSON.stringify(resBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};
