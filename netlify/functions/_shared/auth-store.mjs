import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'career-future-auth-state';
const STATE_KEY = 'state';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function initialState() {
  return {
    users: {},
    emailIndex: {},
    phoneIndex: {},
    wechatIndex: {},
    phoneCodes: {},
    data: {}
  };
}

function normalizeState(state) {
  const next = state && typeof state === 'object' ? state : initialState();
  next.users = next.users || {};
  next.emailIndex = next.emailIndex || {};
  next.phoneIndex = next.phoneIndex || {};
  next.wechatIndex = next.wechatIndex || {};
  next.phoneCodes = next.phoneCodes || {};
  next.data = next.data || {};
  return next;
}

function newUserData() {
  return {
    profile: {},
    assessments: [],
    resumes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizePhone(phone = '') {
  const digits = String(phone).trim().replace(/[^\d+]/g, '');
  if (/^\+86\d{11}$/.test(digits)) return digits;
  if (/^86\d{11}$/.test(digits)) return `+${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+86${digits}`;
  return digits;
}

function uid() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + ':' + String(salt)).digest('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

function authSecret() {
  return process.env.AUTH_SECRET || 'dev-secret';
}

function createToken(user, issuedAt = Date.now()) {
  if (!user?.id) throw new Error('MISSING_USER_ID');
  const payload = JSON.stringify({ id: user.id, iat: issuedAt, exp: issuedAt + TOKEN_TTL_MS });
  const secret = authSecret();
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

function verifyToken(token, now = Date.now()) {
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

function getAuthenticatedUser(req) {
  const header = req?.headers?.get?.('authorization') || req?.headers?.authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? verifyToken(match[1]) : null;
}

function ownsUserId(user, userId) {
  return Boolean(user?.id && user.id === String(userId || '').trim());
}

async function readState() {
  const store = getStore(STORE_NAME);
  const state = await store.get(STATE_KEY, { type: 'json' }).catch(() => null);
  return normalizeState(state);
}

async function writeState(state) {
  const store = getStore(STORE_NAME);
  await store.setJSON(STATE_KEY, normalizeState(state));
}

function ensureDataRecord(state, userId) {
  if (!state.data[userId]) {
    state.data[userId] = newUserData();
  }
  return state.data[userId];
}

async function withState(mutator) {
  const state = await readState();
  const result = await mutator(state);
  await writeState(state);
  return result;
}

export {
  createToken,
  getAuthenticatedUser,
  ensureDataRecord,
  hashPassword,
  normalizePhone,
  ownsUserId,
  readState,
  sanitizeUser,
  uid,
  verifyToken,
  withState,
  writeState,
  newUserData
};

export async function ensureDemoUser() {
  const DEMO_EMAIL = String(process.env.DEMO_EMAIL || 'demo@example.com').trim().toLowerCase();
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo12345';
  return withState((state) => {
    const existingId = state.emailIndex[DEMO_EMAIL];
    if (existingId && state.users[existingId]) {
      return state.users[existingId];
    }

    const id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const user = {
      id,
      name: '演示用户',
      email: DEMO_EMAIL,
      passwordHash: hashPassword(DEMO_PASSWORD, salt),
      salt,
      registeredAt: new Date().toISOString(),
      avatar: ''
    };

    state.users[id] = user;
    state.emailIndex[DEMO_EMAIL] = id;
    state.data[id] = state.data[id] || newUserData();
    return user;
  });
}

export async function createUser({ email = '', password = '', name = '', phone = '' }) {
  return withState((state) => {
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    if (normalizedEmail && state.emailIndex[normalizedEmail]) throw new Error('EMAIL_EXISTS');
    if (normalizedPhone && state.phoneIndex[normalizedPhone]) throw new Error('PHONE_EXISTS');

    const id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const user = {
      id,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: name || '',
      passwordHash: hashPassword(password, salt),
      salt,
      registeredAt: new Date().toISOString(),
      avatar: ''
    };

    state.users[id] = user;
    if (normalizedEmail) state.emailIndex[normalizedEmail] = id;
    if (normalizedPhone) state.phoneIndex[normalizedPhone] = id;
    state.data[id] = state.data[id] || newUserData();
    return user;
  });
}

export async function findUserByEmail(email) {
  const state = await readState();
  const id = state.emailIndex[String(email).trim().toLowerCase()];
  return id ? state.users[id] || null : null;
}

export async function findUserByPhone(phone) {
  const state = await readState();
  const id = state.phoneIndex[normalizePhone(phone)];
  return id ? state.users[id] || null : null;
}

export async function verifyLogin(identifier, password) {
  const value = String(identifier || '').trim();
  const user = value.includes('@') ? await findUserByEmail(value) : await findUserByPhone(value);
  if (!user) return null;
  return user.passwordHash === hashPassword(password, user.salt) ? user : null;
}

export async function createPhoneCode(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!/^\+86\d{11}$/.test(normalizedPhone)) throw new Error('INVALID_PHONE');

  return withState((state) => {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    state.phoneCodes[normalizedPhone] = { code, expiresAt };
    return { phone: normalizedPhone, code, expiresAt };
  });
}

export async function verifyPhoneCode(phone, code) {
  const normalizedPhone = normalizePhone(phone);
  return withState((state) => {
    const record = state.phoneCodes[normalizedPhone];
    if (!record || record.expiresAt < Date.now() || String(record.code) !== String(code).trim()) {
      throw new Error('INVALID_CODE');
    }
    delete state.phoneCodes[normalizedPhone];
    return normalizedPhone;
  });
}

export async function loginOrCreatePhoneUser({ phone, code, name = '' }) {
  return withState((state) => {
    const normalizedPhone = normalizePhone(phone);
    const record = state.phoneCodes[normalizedPhone];
    if (!record || record.expiresAt < Date.now() || String(record.code) !== String(code).trim()) {
      throw new Error('INVALID_CODE');
    }
    delete state.phoneCodes[normalizedPhone];

    const existingId = state.phoneIndex[normalizedPhone];
    if (existingId && state.users[existingId]) return state.users[existingId];

    const id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const user = {
      id,
      email: '',
      phone: normalizedPhone,
      name: name || `用户${normalizedPhone.slice(-4)}`,
      passwordHash: hashPassword(crypto.randomBytes(18).toString('hex'), salt),
      salt,
      registeredAt: new Date().toISOString(),
      avatar: ''
    };

    state.users[id] = user;
    state.phoneIndex[normalizedPhone] = id;
    state.data[id] = state.data[id] || newUserData();
    return user;
  });
}

export async function upsertWechatUser({ openid, unionid = '', nickname = '', avatar = '' }) {
  if (!openid) throw new Error('MISSING_OPENID');

  return withState((state) => {
    const existingId = state.wechatIndex[openid];
    if (existingId && state.users[existingId]) {
      const existing = state.users[existingId];
      const next = {
        ...existing,
        wechatOpenid: openid,
        wechatUnionid: unionid || existing.wechatUnionid || '',
        name: nickname || existing.name || '微信用户',
        avatar: avatar || existing.avatar || ''
      };
      state.users[existingId] = next;
      return next;
    }

    const id = uid();
    const salt = crypto.randomBytes(8).toString('hex');
    const user = {
      id,
      email: '',
      phone: '',
      name: nickname || '微信用户',
      avatar,
      wechatOpenid: openid,
      wechatUnionid: unionid,
      passwordHash: hashPassword(crypto.randomBytes(18).toString('hex'), salt),
      salt,
      registeredAt: new Date().toISOString()
    };

    state.users[id] = user;
    state.wechatIndex[openid] = id;
    state.data[id] = state.data[id] || newUserData();
    return user;
  });
}

export async function getUserData(userId) {
  const state = await readState();
  return state.data[userId] || null;
}

export async function upsertUserData(userId, patch) {
  return withState((state) => {
    state.data[userId] = { ...(state.data[userId] || newUserData()), ...patch };
    return state.data[userId];
  });
}

export async function addAssessment(userId, assessment) {
  return withState((state) => {
    const data = state.data[userId] || newUserData();
    data.assessments = Array.isArray(data.assessments) ? data.assessments : [];
    data.assessments.unshift(assessment);
    data.updatedAt = new Date().toISOString();
    state.data[userId] = data;
    return assessment;
  });
}
