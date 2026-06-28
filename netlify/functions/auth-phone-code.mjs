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

async function sendSmsCode(phone, code) {
  if (process.env.SMS_PROVIDER !== 'twilio') return false;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;

  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `职向未来验证码：${code}，10分钟内有效。`
  });

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || '短信发送失败');
  }
  return true;
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

  let sentBySms = false;
  try {
    sentBySms = await sendSmsCode(phone, code);
  } catch (err) {
    return new Response(JSON.stringify({ error: '短信服务发送失败，请稍后重试或联系管理员配置短信服务' }), {
      status: 502,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    phone,
    expiresAt,
    delivery: sentBySms ? 'sms' : 'screen',
    devCode: sentBySms ? undefined : code
  }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
};
