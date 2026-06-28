import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const WordExtractor = require('word-extractor');
const Tesseract = require('tesseract.js');
import {
  ensureDemoUser,
  createUser,
  verifyLogin,
  sanitizeUser,
  createToken,
  getUserData,
  addAssessment,
  upsertUserData,
  createPhoneCode,
  loginOrCreatePhoneUser,
  upsertWechatUser
} from './db.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

if (!API_KEY) {
  console.warn('[DeepSeek] Missing DEEPSEEK_API_KEY in environment');
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

// 初始化演示账户
const demoUser = ensureDemoUser();

// 认证与用户数据（按用户ID索引）
app.post('/api/auth/register', (req, res) => {
  try {
    const { email = '', password = '', name = '', phone = '' } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '邮箱与密码为必填' });
    const user = createUser({ email, password, name, phone });
    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    if (String(err?.message) === 'EMAIL_EXISTS') return res.status(409).json({ error: '邮箱已注册' });
    if (String(err?.message) === 'PHONE_EXISTS') return res.status(409).json({ error: '手机号已注册' });
    console.error('[auth/register] error:', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email = '', identifier = '', password = '' } = req.body || {};
    const loginId = identifier || email;
    if (!loginId || !password) return res.status(400).json({ error: '账号与密码为必填' });
    const user = verifyLogin(loginId, password);
    if (!user) return res.status(401).json({ error: '邮箱或密码错误' });
    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/login] error:', err);
    return res.status(500).json({ error: '登录失败' });
  }
});

app.post('/api/auth/phone-code', async (req, res) => {
  try {
    const { phone = '' } = req.body || {};
    const result = createPhoneCode(phone);
    const sentBySms = await sendSmsCode(result.phone, result.code);
    return res.json({
      ok: true,
      phone: result.phone,
      expiresAt: result.expiresAt,
      delivery: sentBySms ? 'sms' : 'screen',
      devCode: sentBySms ? undefined : result.code
    });
  } catch (err) {
    if (String(err?.message) === 'INVALID_PHONE') return res.status(400).json({ error: '请输入有效的中国大陆手机号' });
    console.error('[auth/phone-code] error:', err);
    return res.status(500).json({ error: '验证码发送失败' });
  }
});

app.post('/api/auth/phone-login', (req, res) => {
  try {
    const { phone = '', code = '', name = '' } = req.body || {};
    const user = loginOrCreatePhoneUser({ phone, code, name });
    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    if (String(err?.message) === 'INVALID_CODE') return res.status(401).json({ error: '验证码错误或已过期' });
    console.error('[auth/phone-login] error:', err);
    return res.status(500).json({ error: '手机号登录失败' });
  }
});

app.get('/api/auth/wechat/start', (_req, res) => {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = process.env.WECHAT_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return res.status(501).json({ error: '微信登录需要配置 WECHAT_APP_ID 与 WECHAT_REDIRECT_URI' });
  }
  const state = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
  url.searchParams.set('appid', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'snsapi_login');
  url.searchParams.set('state', state);
  return res.json({ url: `${url.toString()}#wechat_redirect` });
});

app.get('/api/auth/wechat/callback', async (req, res) => {
  try {
    const { code = '' } = req.query || {};
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (!code) return res.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信授权失败')}`);
    if (!appId || !appSecret) {
      return res.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录需要配置 WECHAT_APP_ID 与 WECHAT_APP_SECRET')}`);
    }

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.searchParams.set('appid', appId);
    tokenUrl.searchParams.set('secret', appSecret);
    tokenUrl.searchParams.set('code', String(code));
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
    return res.redirect(`${frontendUrl}/login?auth_token=${encodeURIComponent(token)}&user=${payload}`);
  } catch (err) {
    console.error('[auth/wechat/callback] error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录失败，请稍后重试')}`);
  }
});

app.post('/api/auth/demo', (_req, res) => {
  try {
    const token = createToken(demoUser);
    return res.json({ token, user: sanitizeUser(demoUser) });
  } catch (err) {
    console.error('[auth/demo] error:', err);
    return res.status(500).json({ error: '演示登录失败' });
  }
});

app.get('/api/users/:id/data', (req, res) => {
  try {
    const userId = req.params.id;
    const data = getUserData(userId);
    if (!data) return res.status(404).json({ error: '用户数据不存在' });
    return res.json({ userId, data });
  } catch (err) {
    console.error('[users/data] error:', err);
    return res.status(500).json({ error: '获取用户数据失败' });
  }
});

app.post('/api/users/:id/assessments', (req, res) => {
  try {
    const userId = req.params.id;
    const assessment = req.body || {};
    if (!assessment || !assessment.id) return res.status(400).json({ error: 'assessment内容缺失' });
    const saved = addAssessment(userId, assessment);
    return res.json({ ok: true, saved });
  } catch (err) {
    console.error('[users/assessments] error:', err);
    return res.status(500).json({ error: '保存测评结果失败' });
  }
});

app.post('/api/users/:id/data', (req, res) => {
  try {
    const userId = req.params.id;
    const patch = req.body || {};
    const merged = upsertUserData(userId, patch);
    return res.json({ ok: true, data: merged });
  } catch (err) {
    console.error('[users/data upsert] error:', err);
    return res.status(500).json({ error: '更新用户数据失败' });
  }
});

// 文件文本提取（支持 PDF / DOCX / DOC / TXT）
app.post('/api/extract-text', async (req, res) => {
  const t0 = Date.now();
  try {
    const { fileName = '', mimeType = '', dataBase64 = '' } = req.body || {};
    if (!dataBase64) {
      console.warn(`[extract-text] 400 missing dataBase64 fileName=${fileName} mimeType=${mimeType}`);
      return res.status(400).json({ error: 'missing dataBase64' });
    }
    const buf = Buffer.from(String(dataBase64), 'base64');
    const lowerName = String(fileName).toLowerCase();

    // TXT 直接返回
    if (mimeType.startsWith('text/') || lowerName.endsWith('.txt')) {
      const text = buf.toString('utf-8');
      console.log(`[extract-text] method=txt fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
      return res.json({ text, method: 'txt' });
    }

    // 先处理图片OCR（JPG/PNG/BMP等）
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|bmp|tif?f)$/i.test(lowerName)) {
      try {
        const result = await Tesseract.recognize(buf, 'chi_sim+eng', { logger: () => {} });
        const text = String(result?.data?.text || '').trim();
        console.log(`[extract-text] method=ocr-image fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
        return res.json({ text, method: 'ocr-image' });
      } catch (ocrErr) {
        console.warn('[OCR] image ocr failed:', ocrErr);
        return res.status(500).json({ error: 'ocr failed', details: String(ocrErr) });
      }
    }

    // DOCX
    if (lowerName.endsWith('.docx') || mimeType.includes('officedocument.wordprocessingml.document')) {
      const result = await mammoth.extractRawText({ buffer: buf });
      const text = (result?.value || '').trim();
      console.log(`[extract-text] method=docx fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
      return res.json({ text, method: 'docx' });
    }

    // DOC（高质量解析）
    if (lowerName.endsWith('.doc') || mimeType.includes('msword')) {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buf);
      const text = String(doc?.getText?.() || doc?.getBody?.() || '').trim();
      console.log(`[extract-text] method=doc fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
      return res.json({ text, method: 'doc' });
    }

    // PDF
    if (lowerName.endsWith('.pdf') || mimeType.includes('pdf')) {
      const data = await pdfParse(buf);
      const text = String(data?.text || '').trim();
      console.log(`[extract-text] method=pdf fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
      return res.json({ text, method: 'pdf' });
    }

    // 其他格式暂不支持，回退为二进制直接转utf-8
    const text = buf.toString('utf-8');
    console.log(`[extract-text] method=binary-utf8 fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
    return res.json({ text, method: 'binary-utf8' });
  } catch (err) {
    console.error('[ExtractText] error:', err);
    console.warn(`[extract-text] 500 fileName=${req.body?.fileName} mimeType=${req.body?.mimeType} dur=${Date.now()-t0}ms`);
    return res.status(500).json({ error: 'extract failed', details: String(err) });
  }
});

app.post('/api/deepseek/chat', async (req, res) => {
  const t0 = Date.now();
  try {
    const { messages, model = 'deepseek-chat', temperature = 0.7, stream = false } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      console.warn('[deepseek/chat] 400 invalid messages');
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }
    if (!API_KEY) {
      console.warn('[deepseek/chat] 500 missing api key');
      return res.status(500).json({ error: 'Server is not configured with DEEPSEEK_API_KEY' });
    }

    // Streaming support
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model, messages, temperature, stream: true }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[deepseek/chat] stream error status=${response.status} dur=${Date.now()-t0}ms`);
        res.status(response.status);
        res.write(`data: ${JSON.stringify({ error: 'DeepSeek API error', details: text })}\n\n`);
        return res.end();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += (value?.length || 0);
        res.write(decoder.decode(value, { stream: true }));
      }
      console.log(`[deepseek/chat] stream done status=${response.status} bytes=${bytes} dur=${Date.now()-t0}ms`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Non-streaming
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[deepseek/chat] non-stream error status=${response.status} dur=${Date.now()-t0}ms`);
      return res.status(response.status).json({ error: 'DeepSeek API error', details: text });
    }

    const data = await response.json();
    const usage = data?.usage || {};
    const len = JSON.stringify(data).length;
    console.log(`[deepseek/chat] non-stream done status=${response.status} size=${len} prompt_tokens=${usage.prompt_tokens || 0} completion_tokens=${usage.completion_tokens || 0} dur=${Date.now()-t0}ms`);
    return res.json(data);
  } catch (err) {
    console.error('[DeepSeek] Proxy error:', err);
    console.warn(`[deepseek/chat] proxy error dur=${Date.now()-t0}ms`);
    return res.status(500).json({ error: 'Proxy error', details: String(err) });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[Server] DeepSeek proxy listening on http://localhost:${PORT}`);
});
