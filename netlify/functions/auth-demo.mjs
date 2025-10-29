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

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
  const DEMO_NAME = process.env.DEMO_NAME || '演示账户';

  const db = readDB();
  let id = db.emailIndex[DEMO_EMAIL];
  if (!id) {
    id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const passwordHash = hashPassword(DEMO_PASSWORD, salt);
    const user = { id, email: DEMO_EMAIL, name: DEMO_NAME, avatar: '', passwordHash, salt, registeredAt: new Date().toISOString() };
    db.users[id] = user;
    db.emailIndex[DEMO_EMAIL] = id;
    db.data[id] = db.data[id] || { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
    writeDB(db);
  }

  const user = db.users[id];
  const token = createToken(user);
  const resBody = { token, user: sanitizeUser(user) };
  return new Response(JSON.stringify(resBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};

