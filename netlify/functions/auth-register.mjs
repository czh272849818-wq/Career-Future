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
    if (!obj.users || !obj.emailIndex) return { users: {}, emailIndex: {}, data: {} };
    return obj;
  } catch {
    return { users: {}, emailIndex: {}, data: {} };
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

  const { email = '', password = '', name = '' } = body || {};
  if (!email || !password) {
    return new Response(JSON.stringify({ error: '邮箱与密码为必填' }), { status: 400, headers });
  }

  const db = readDB();
  if (db.emailIndex[email]) {
    return new Response(JSON.stringify({ error: '邮箱已注册' }), { status: 409, headers });
  }

  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user = { id, email, name, passwordHash, salt, registeredAt: new Date().toISOString(), avatar: '' };
  db.users[id] = user;
  db.emailIndex[email] = id;
  db.data[id] = db.data[id] || { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  writeDB(db);

  const token = createToken(user);
  const resBody = { token, user: sanitizeUser(user) };
  return new Response(JSON.stringify(resBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};

