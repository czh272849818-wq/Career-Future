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

function normalizePhone(phone = '') {
  const digits = String(phone).trim().replace(/[^\d+]/g, '');
  if (/^\+86\d{11}$/.test(digits)) return digits;
  if (/^86\d{11}$/.test(digits)) return `+${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+86${digits}`;
  return digits;
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
  if (!/^\+86\d{11}$/.test(phone)) {
    return new Response(JSON.stringify({ error: '请输入有效的中国大陆手机号' }), { status: 400, headers });
  }

  const db = readDB();
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  db.phoneCodes[phone] = { code, expiresAt };
  writeDB(db);

  const hasSmsProvider = Boolean(process.env.SMS_PROVIDER);
  return new Response(JSON.stringify({
    ok: true,
    phone,
    expiresAt,
    delivery: hasSmsProvider ? 'sms' : 'screen',
    devCode: hasSmsProvider ? undefined : code
  }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};
