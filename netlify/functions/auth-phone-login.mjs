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
    const obj = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    obj.users = obj.users || {};
    obj.emailIndex = obj.emailIndex || {};
    obj.phoneIndex = obj.phoneIndex || {};
    obj.wechatIndex = obj.wechatIndex || {};
    obj.phoneCodes = obj.phoneCodes || {};
    obj.data = obj.data || {};
    return obj;
  } catch {
    return { users: {}, emailIndex: {}, phoneIndex: {}, wechatIndex: {}, phoneCodes: {}, data: {} };
  }
}

function writeDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch {}
}

function uid() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
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
  const db = readDB();
  const record = db.phoneCodes[phone];
  if (!record || record.expiresAt < Date.now() || String(record.code) !== code) {
    return new Response(JSON.stringify({ error: '验证码错误或已过期' }), { status: 401, headers });
  }
  delete db.phoneCodes[phone];

  let id = db.phoneIndex[phone];
  if (!id || !db.users[id]) {
    id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const passwordHash = hashPassword(crypto.randomBytes(18).toString('hex'), salt);
    db.users[id] = {
      id,
      email: '',
      phone,
      name: body?.name || `用户${phone.slice(-4)}`,
      avatar: '',
      passwordHash,
      salt,
      registeredAt: new Date().toISOString()
    };
    db.phoneIndex[phone] = id;
    db.data[id] = { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  }
  writeDB(db);

  const user = db.users[id];
  return new Response(JSON.stringify({ token: createToken(user), user: sanitizeUser(user) }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
};
