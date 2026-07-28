import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function authSecret() {
  return process.env.AUTH_SECRET || 'dev-secret';
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: {}, emailIndex: {}, phoneIndex: {}, wechatIndex: {}, phoneCodes: {}, data: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readDB() {
  ensureDataFile();
  const txt = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    const db = JSON.parse(txt);
    db.users = db.users || {};
    db.emailIndex = db.emailIndex || {};
    db.phoneIndex = db.phoneIndex || {};
    db.wechatIndex = db.wechatIndex || {};
    db.phoneCodes = db.phoneCodes || {};
    db.data = db.data || {};
    return db;
  } catch {
    const fallback = { users: {}, emailIndex: {}, phoneIndex: {}, wechatIndex: {}, phoneCodes: {}, data: {} };
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

function createUserData() {
  return { profile: {}, assessments: [], chatSessions: [], currentSessionId: null, resumes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + ':' + String(salt)).digest('hex');
}

export function normalizePhone(phone = '') {
  const raw = String(phone).trim();
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+86\d{11}$/.test(digits)) return digits;
  if (/^86\d{11}$/.test(digits)) return `+${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+86${digits}`;
  return digits;
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
  db.data[id] = db.data[id] || createUserData();
  writeDB(db);
  return user;
}

export function createUser({ email = '', password = '', name = '', phone = '' }) {
  const db = readDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  if (normalizedEmail && db.emailIndex[normalizedEmail]) throw new Error('EMAIL_EXISTS');
  if (normalizedPhone && db.phoneIndex[normalizedPhone]) throw new Error('PHONE_EXISTS');
  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user = {
    id,
    email: normalizedEmail,
    phone: normalizedPhone,
    name: name || '',
    passwordHash,
    salt,
    registeredAt: new Date().toISOString(),
    avatar: ''
  };
  db.users[id] = user;
  if (normalizedEmail) db.emailIndex[normalizedEmail] = id;
  if (normalizedPhone) db.phoneIndex[normalizedPhone] = id;
  db.data[id] = createUserData();
  writeDB(db);
  return user;
}

export function findUserByEmail(email) {
  const db = readDB();
  const id = db.emailIndex[String(email).trim().toLowerCase()];
  if (!id) return null;
  return db.users[id] || null;
}

export function findUserByPhone(phone) {
  const db = readDB();
  const id = db.phoneIndex[normalizePhone(phone)];
  if (!id) return null;
  return db.users[id] || null;
}

export function verifyLogin(identifier, password) {
  const value = String(identifier || '').trim();
  const user = value.includes('@') ? findUserByEmail(value) : findUserByPhone(value);
  if (!user) return null;
  const ok = user.passwordHash === hashPassword(password, user.salt);
  return ok ? user : null;
}

export function createPhoneCode(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!/^\+86\d{11}$/.test(normalizedPhone)) throw new Error('INVALID_PHONE');
  const db = readDB();
  const code = crypto.randomInt(100000, 999999).toString();
  db.phoneCodes[normalizedPhone] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  writeDB(db);
  return { phone: normalizedPhone, code, expiresAt: db.phoneCodes[normalizedPhone].expiresAt };
}

export function verifyPhoneCode(phone, code) {
  const normalizedPhone = normalizePhone(phone);
  const db = readDB();
  const record = db.phoneCodes[normalizedPhone];
  if (!record || record.expiresAt < Date.now() || String(record.code) !== String(code).trim()) {
    throw new Error('INVALID_CODE');
  }
  delete db.phoneCodes[normalizedPhone];
  writeDB(db);
  return normalizedPhone;
}

export function loginOrCreatePhoneUser({ phone, code, name = '' }) {
  const normalizedPhone = verifyPhoneCode(phone, code);
  const db = readDB();
  const existingId = db.phoneIndex[normalizedPhone];
  if (existingId && db.users[existingId]) return db.users[existingId];

  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(crypto.randomBytes(18).toString('hex'), salt);
  const user = {
    id,
    email: '',
    phone: normalizedPhone,
    name: name || `用户${normalizedPhone.slice(-4)}`,
    passwordHash,
    salt,
    registeredAt: new Date().toISOString(),
    avatar: ''
  };
  db.users[id] = user;
  db.phoneIndex[normalizedPhone] = id;
  db.data[id] = createUserData();
  writeDB(db);
  return user;
}

export function upsertWechatUser({ openid, unionid = '', nickname = '', avatar = '' }) {
  if (!openid) throw new Error('MISSING_OPENID');
  const db = readDB();
  const existingId = db.wechatIndex[openid];
  if (existingId && db.users[existingId]) {
    const existing = db.users[existingId];
    db.users[existingId] = {
      ...existing,
      wechatOpenid: openid,
      wechatUnionid: unionid || existing.wechatUnionid || '',
      name: nickname || existing.name || '微信用户',
      avatar: avatar || existing.avatar || ''
    };
    writeDB(db);
    return db.users[existingId];
  }

  const id = uid();
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(crypto.randomBytes(18).toString('hex'), salt);
  const user = {
    id,
    email: '',
    phone: '',
    name: nickname || '微信用户',
    avatar,
    wechatOpenid: openid,
    wechatUnionid: unionid,
    passwordHash,
    salt,
    registeredAt: new Date().toISOString()
  };
  db.users[id] = user;
  db.wechatIndex[openid] = id;
  db.data[id] = createUserData();
  writeDB(db);
  return user;
}

export function getUserData(userId) {
  const db = readDB();
  return db.data[userId] || null;
}

export function upsertUserData(userId, patch) {
  const db = readDB();
  db.data[userId] = { ...(db.data[userId] || createUserData()), ...patch, updatedAt: new Date().toISOString() };
  writeDB(db);
  return db.data[userId];
}

export function addAssessment(userId, assessment) {
  const db = readDB();
  const data = db.data[userId] || createUserData();
  data.assessments = Array.isArray(data.assessments) ? data.assessments : [];
  data.assessments.unshift(assessment);
  db.data[userId] = data;
  writeDB(db);
  return assessment;
}

export function createToken(user, issuedAt = Date.now()) {
  if (!user?.id) throw new Error('MISSING_USER_ID');
  const payload = JSON.stringify({ id: user.id, iat: issuedAt, exp: issuedAt + TOKEN_TTL_MS });
  const sig = crypto.createHmac('sha256', authSecret()).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

export function verifyToken(token, now = Date.now()) {
  const [encodedPayload, signature, ...extra] = String(token || '').split('.');
  if (!encodedPayload || !signature || extra.length) return null;

  const payloadText = Buffer.from(encodedPayload, 'base64').toString('utf8');
  const expected = crypto.createHmac('sha256', authSecret()).update(payloadText).digest('hex');
  const supplied = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(payloadText);
    const issuedAt = Number(payload?.iat ?? payload?.ts);
    const expiresAt = Number(payload?.exp ?? (issuedAt + TOKEN_TTL_MS));
    if (!payload?.id || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt < now) return null;
    return { id: String(payload.id) };
  } catch {
    return null;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}
