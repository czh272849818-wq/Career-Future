import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret';

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: {}, emailIndex: {}, data: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readDB() {
  ensureDataFile();
  const txt = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(txt);
  } catch {
    const fallback = { users: {}, emailIndex: {}, data: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function uid() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + ':' + String(salt)).digest('hex');
}

export function ensureDemoUser() {
  const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo12345';
  const db = readDB();
  if (db.emailIndex[DEMO_EMAIL]) return db.users[db.emailIndex[DEMO_EMAIL]];
  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(DEMO_PASSWORD, salt);
  const user = {
    id,
    name: '演示用户',
    email: DEMO_EMAIL,
    passwordHash,
    salt,
    registeredAt: new Date().toISOString(),
    avatar: ''
  };
  db.users[id] = user;
  db.emailIndex[DEMO_EMAIL] = id;
  db.data[id] = db.data[id] || { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  writeDB(db);
  return user;
}

export function createUser({ email, password, name }) {
  const db = readDB();
  if (db.emailIndex[email]) throw new Error('EMAIL_EXISTS');
  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user = { id, email, name: name || '', passwordHash, salt, registeredAt: new Date().toISOString(), avatar: '' };
  db.users[id] = user;
  db.emailIndex[email] = id;
  db.data[id] = { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  writeDB(db);
  return user;
}

export function findUserByEmail(email) {
  const db = readDB();
  const id = db.emailIndex[email];
  if (!id) return null;
  return db.users[id] || null;
}

export function verifyLogin(email, password) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const ok = user.passwordHash === hashPassword(password, user.salt);
  return ok ? user : null;
}

export function getUserData(userId) {
  const db = readDB();
  return db.data[userId] || null;
}

export function upsertUserData(userId, patch) {
  const db = readDB();
  db.data[userId] = { ...(db.data[userId] || {}), ...patch };
  writeDB(db);
  return db.data[userId];
}

export function addAssessment(userId, assessment) {
  const db = readDB();
  const data = db.data[userId] || { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  data.assessments = Array.isArray(data.assessments) ? data.assessments : [];
  data.assessments.unshift(assessment);
  db.data[userId] = data;
  writeDB(db);
  return assessment;
}

export function createToken(user) {
  // 轻量令牌（非JWT）：HMAC签名的payload
  const payload = JSON.stringify({ id: user.id, ts: Date.now() });
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

