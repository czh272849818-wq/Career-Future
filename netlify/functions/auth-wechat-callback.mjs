import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

function upsertWechatUser({ openid, unionid = '', nickname = '', avatar = '' }) {
  if (!openid) throw new Error('MISSING_OPENID');
  const db = readDB();
  const existingId = db.wechatIndex[openid];
  if (existingId && db.users[existingId]) {
    db.users[existingId] = {
      ...db.users[existingId],
      wechatOpenid: openid,
      wechatUnionid: unionid || db.users[existingId].wechatUnionid || '',
      name: nickname || db.users[existingId].name || '微信用户',
      avatar: avatar || db.users[existingId].avatar || ''
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
  db.data[id] = { profile: {}, assessments: [], chatSessions: [], resumes: [], createdAt: new Date().toISOString() };
  writeDB(db);
  return user;
}

export default async (req) => {
  const frontendUrl = process.env.FRONTEND_URL || new URL(req.url).origin;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!code) return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信授权失败')}`, 302);
    if (!appId || !appSecret) {
      return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录需要配置 WECHAT_APP_ID 与 WECHAT_APP_SECRET')}`, 302);
    }

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.searchParams.set('appid', appId);
    tokenUrl.searchParams.set('secret', appSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || tokenData.errcode) throw new Error(tokenData.errmsg || '微信授权换取失败');

    const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    userUrl.searchParams.set('access_token', tokenData.access_token);
    userUrl.searchParams.set('openid', tokenData.openid);
    userUrl.searchParams.set('lang', 'zh_CN');
    const userResp = await fetch(userUrl);
    const userData = await userResp.json();
    if (!userResp.ok || userData.errcode) throw new Error(userData.errmsg || '微信用户信息获取失败');

    const user = upsertWechatUser({
      openid: userData.openid,
      unionid: userData.unionid,
      nickname: userData.nickname,
      avatar: userData.headimgurl
    });
    const token = createToken(user);
    const payload = encodeURIComponent(JSON.stringify(sanitizeUser(user)));
    return Response.redirect(`${frontendUrl}/login?auth_token=${encodeURIComponent(token)}&user=${payload}`, 302);
  } catch (err) {
    console.error('[auth-wechat-callback] error:', err);
    return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录失败，请稍后重试')}`, 302);
  }
};
