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
let XLSX = null;
import {
  ensureDemoUser,
  createUser,
  verifyLogin,
  sanitizeUser,
  createToken,
  getUserData,
  addAssessment,
  upsertUserData,
  verifyToken
} from './db.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4;

if (!API_KEY) {
  console.warn('[DeepSeek] Missing DEEPSEEK_API_KEY in environment');
}

// 初始化演示账户
ensureDemoUser();

function requireCurrentUser(req, res, requestedUserId) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const user = match ? verifyToken(match[1]) : null;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (requestedUserId && user.id !== String(requestedUserId).trim()) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

// 认证与用户数据（按用户ID索引）
app.post('/api/auth/register', (req, res) => {
  try {
    const { email = '', password = '', name = '', phone = '' } = req.body || {};
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail || !password) return res.status(400).json({ error: '邮箱与密码为必填' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: '请输入有效邮箱地址' });
    if (String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: '密码至少需要 8 位' });
    const user = createUser({ email: normalizedEmail, password, name, phone });
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

app.get('/api/users/:id/data', (req, res) => {
  try {
    const currentUser = requireCurrentUser(req, res, req.params.id);
    if (!currentUser) return;
    const userId = currentUser.id;
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
    const currentUser = requireCurrentUser(req, res, req.params.id);
    if (!currentUser) return;
    const userId = currentUser.id;
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
    const currentUser = requireCurrentUser(req, res, req.params.id);
    if (!currentUser) return;
    const userId = currentUser.id;
    const patch = req.body || {};
    const merged = upsertUserData(userId, patch);
    return res.json({ ok: true, data: merged });
  } catch (err) {
    console.error('[users/data upsert] error:', err);
    return res.status(500).json({ error: '更新用户数据失败' });
  }
});

app.get('/api/chat-sessions', (req, res) => {
  try {
    const currentUser = requireCurrentUser(req, res, req.query.userId);
    if (!currentUser) return;
    const userId = currentUser.id;
    const data = getUserData(userId);
    if (!data) {
      return res.json({ userId, sessions: [], currentSessionId: null, updatedAt: null });
    }
    return res.json({
      userId,
      sessions: Array.isArray(data.chatSessions) ? data.chatSessions : [],
      currentSessionId: data.currentSessionId || null,
      updatedAt: data.updatedAt || null
    });
  } catch (err) {
    console.error('[chat-sessions] error:', err);
    return res.status(500).json({ error: '获取聊天记录失败' });
  }
});

app.post('/api/chat-sessions', (req, res) => {
  try {
    const { userId = '', sessions = [], currentSessionId = null } = req.body || {};
    const currentUser = requireCurrentUser(req, res, userId);
    if (!currentUser) return;
    const merged = upsertUserData(currentUser.id, {
      chatSessions: Array.isArray(sessions) ? sessions : [],
      currentSessionId: currentSessionId || null,
      updatedAt: new Date().toISOString()
    });
    return res.json({ ok: true, userId: currentUser.id, data: merged });
  } catch (err) {
    console.error('[chat-sessions save] error:', err);
    return res.status(500).json({ error: '保存聊天记录失败' });
  }
});

// 文件文本提取（支持 PDF / DOCX / DOC / TXT / XLSX / CSV / 图片 / MP4）
app.post('/api/extract-text', async (req, res) => {
  const t0 = Date.now();
  try {
    const contentType = req.headers['content-type'] || '';
    let fileName = '';
    let mimeType = '';
    let dataBase64 = '';

    if (String(contentType).includes('multipart/form-data')) {
      return res.status(400).json({ error: 'multipart form upload is handled by the client via Netlify function in production' });
    } else {
      const body = req.body || {};
      fileName = body.fileName || '';
      mimeType = body.mimeType || '';
      dataBase64 = body.dataBase64 || '';
    }
    if (!dataBase64) {
      console.warn(`[extract-text] 400 missing dataBase64 fileName=${fileName} mimeType=${mimeType}`);
      return res.status(400).json({ error: 'missing dataBase64' });
    }
    if (String(dataBase64).length > MAX_BASE64_LENGTH) {
      return res.status(413).json({ error: 'file too large', maxBytes: MAX_FILE_BYTES });
    }
    const buf = Buffer.from(String(dataBase64), 'base64');
    const lowerName = String(fileName).toLowerCase();
    const supported = mimeType.startsWith('text/')
      || mimeType.startsWith('image/')
      || mimeType.includes('pdf')
      || mimeType.includes('msword')
      || mimeType.includes('officedocument.wordprocessingml.document')
      || mimeType.includes('spreadsheetml.sheet')
      || mimeType.includes('csv')
      || mimeType === 'video/mp4'
      || /\.(txt|md|pdf|docx?|xlsx?|csv|png|jpe?g|bmp|tif?f|gif|webp|mp4)$/i.test(lowerName);
    if (!supported) return res.status(415).json({ error: 'unsupported file type' });

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

    if (mimeType === 'video/mp4' || lowerName.endsWith('.mp4')) {
      const text = `[视频附件] ${fileName}，大小 ${(buf.length / 1024 / 1024).toFixed(2)} MB。当前仅提取元信息，未做音视频转写。`;
      return res.json({ text, method: 'mp4-meta' });
    }

    if (lowerName.endsWith('.csv') || mimeType.includes('csv')) {
      const text = buf.toString('utf-8');
      return res.json({ text, method: 'csv' });
    }

    if (lowerName.endsWith('.xlsx') || mimeType.includes('spreadsheetml.sheet') || lowerName.endsWith('.xls')) {
      try {
        if (!XLSX) {
          const xlsxModule = await import('xlsx');
          XLSX = xlsxModule.default || xlsxModule;
        }
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheet = workbook.SheetNames[0];
        const json = sheet ? XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 }) : [];
        const text = Array.isArray(json) ? json.map(row => Array.isArray(row) ? row.join('\t') : String(row)).join('\n') : '';
        return res.json({ text, method: 'xlsx' });
      } catch (xlsxErr) {
        console.warn('[XLSX] parse failed:', xlsxErr);
        return res.status(500).json({ error: 'xlsx parse failed', details: String(xlsxErr) });
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

    return res.status(415).json({ error: 'unsupported file type' });
  } catch (err) {
    console.error('[ExtractText] error:', err);
    console.warn(`[extract-text] 500 fileName=${req.body?.fileName} mimeType=${req.body?.mimeType} dur=${Date.now()-t0}ms`);
    return res.status(500).json({ error: 'extract failed', details: String(err) });
  }
});

app.post('/api/deepseek/chat', async (req, res) => {
  const t0 = Date.now();
  try {
    const { messages, attachmentContext = [], model = 'deepseek-chat', temperature = 0.7, stream = false } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      console.warn('[deepseek/chat] 400 invalid messages');
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }
    if (!API_KEY) {
      console.warn('[deepseek/chat] 500 missing api key');
      return res.status(500).json({ error: 'Server is not configured with DEEPSEEK_API_KEY' });
    }

    const attachmentText = Array.isArray(attachmentContext) && attachmentContext.length
      ? attachmentContext.map((item) => {
          if (!item) return '';
          const name = item.name || 'unknown';
          const type = item.type || 'unknown';
          const size = typeof item.size === 'number' ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : 'unknown size';
          const text = String(item.text || '').trim();
          return [`- ${name} (${type}, ${size})`, text ? `  内容: ${text}` : ''].filter(Boolean).join('\n');
        }).filter(Boolean).join('\n')
      : '';
    const attachmentSystemMessage = attachmentText
      ? {
          role: 'system',
          content: `附件上下文仅供参考，不要在回答中逐字复述，只提炼与用户问题相关的信息：\n${attachmentText}`
        }
      : null;
    const upstreamMessages = attachmentSystemMessage ? [messages[0], attachmentSystemMessage, ...messages.slice(1)] : messages;

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
        body: JSON.stringify({ model, messages: upstreamMessages, temperature, stream: true }),
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
        messages: upstreamMessages,
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
