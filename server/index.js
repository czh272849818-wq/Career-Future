import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const WordExtractor = require('word-extractor');
const Tesseract = require('tesseract.js');

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