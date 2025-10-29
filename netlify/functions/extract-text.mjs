// 按需动态加载依赖，避免在未安装依赖时顶层初始化失败导致 502

// Netlify Node Function: 简历文本提取（支持 TXT / DOCX / DOC / PDF / 图片OCR）
export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const t0 = Date.now();
  try {
    const { fileName = '', mimeType = '', dataBase64 = '' } = body || {};
    if (!dataBase64) {
      console.warn(`[extract-text] 400 missing dataBase64 fileName=${fileName} mimeType=${mimeType}`);
      return new Response(JSON.stringify({ error: 'missing dataBase64' }), { status: 400, headers });
    }
    const buf = Buffer.from(String(dataBase64), 'base64');
    const lowerName = String(fileName).toLowerCase();

    // TXT 直接返回
    if (mimeType.startsWith('text/') || lowerName.endsWith('.txt')) {
      const text = buf.toString('utf-8');
      console.log(`[extract-text] method=txt fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
      return new Response(JSON.stringify({ text, method: 'txt' }), { headers });
    }

    // 图片 OCR（JPG/PNG/BMP/TIFF）
    if (mimeType.startsWith('image/') || /(png|jpe?g|bmp|tif?f)$/i.test(lowerName)) {
      try {
        const tModule = await import('tesseract.js');
        const Tesseract = tModule.default || tModule;
        const result = await Tesseract.recognize(buf, 'chi_sim+eng', { logger: () => {} });
        const text = String(result?.data?.text || '').trim();
        console.log(`[extract-text] method=ocr-image fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
        return new Response(JSON.stringify({ text, method: 'ocr-image' }), { headers });
      } catch (ocrErr) {
        console.warn('[OCR] image ocr failed:', ocrErr);
        return new Response(JSON.stringify({ error: 'ocr failed', details: String(ocrErr) }), { status: 500, headers });
      }
    }

    // DOCX
    if (lowerName.endsWith('.docx') || mimeType.includes('officedocument.wordprocessingml.document')) {
      try {
        const mModule = await import('mammoth');
        const mammoth = mModule.default || mModule;
        const result = await mammoth.extractRawText({ buffer: buf });
        const text = (result?.value || '').trim();
        console.log(`[extract-text] method=docx fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
        return new Response(JSON.stringify({ text, method: 'docx' }), { headers });
      } catch (docxErr) {
        console.warn('[DOCX] mammoth import/parse failed:', docxErr);
        // 尝试直接 UTF-8 作为兜底，避免 502；用户可重新上传 PDF 或 TXT
        const text = buf.toString('utf-8');
        return new Response(JSON.stringify({ text, method: 'docx-fallback-utf8', warn: 'docx parser unavailable' }), { headers });
      }
    }

    // DOC
    if (lowerName.endsWith('.doc') || mimeType.includes('msword')) {
      try {
        const weModule = await import('word-extractor');
        const WordExtractor = weModule.default || weModule;
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buf);
        const text = String(doc?.getText?.() || doc?.getBody?.() || '').trim();
        console.log(`[extract-text] method=doc fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
        return new Response(JSON.stringify({ text, method: 'doc' }), { headers });
      } catch (docErr) {
        console.warn('[DOC] parse failed, fallback to utf-8:', docErr);
        const text = buf.toString('utf-8');
        return new Response(JSON.stringify({ text, method: 'doc-fallback-utf8' }), { headers });
      }
    }

    // PDF：优先使用 pdfreader（Node 纯文本提取），失败再尝试 pdf-parse
    if (lowerName.endsWith('.pdf') || mimeType.includes('pdf')) {
      try {
        const pdfreaderModule = await import('pdfreader');
        const PdfReader = pdfreaderModule.PdfReader || pdfreaderModule.default?.PdfReader || pdfreaderModule?.default || pdfreaderModule;
        const text = await new Promise((resolve, reject) => {
          const rows = {};
          try {
            new PdfReader().parseBuffer(buf, (err, item) => {
              if (err) return reject(err);
              if (!item) {
                const lines = Object.keys(rows)
                  .sort((a, b) => parseFloat(a) - parseFloat(b))
                  .map((y) => (rows[y] || []).map((i) => i.text).join(' '))
                  .join('\n');
                return resolve(lines.trim());
              }
              if (item.text) {
                (rows[item.y] = rows[item.y] || []).push(item);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
        console.log(`[extract-text] method=pdfreader fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
        return new Response(JSON.stringify({ text, method: 'pdfreader' }), { headers });
      } catch (readerErr) {
        console.warn('[PDF] pdfreader failed, try pdf-parse:', readerErr);
        try {
          const pdfModule = await import('pdf-parse');
          const pdfParse = pdfModule.default || pdfModule;
          const data = await pdfParse(buf);
          const text = String(data?.text || '').trim();
          console.log(`[extract-text] method=pdf fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
          return new Response(JSON.stringify({ text, method: 'pdf' }), { headers });
        } catch (pdfErr) {
          console.warn('[PDF] pdf-parse failed:', pdfErr);
          return new Response(JSON.stringify({ error: 'pdf parse failed', details: String(pdfErr) }), { status: 500, headers });
        }
      }
    }

    // 其他格式：回退二进制直接转 UTF-8
    const text = buf.toString('utf-8');
    console.log(`[extract-text] method=binary-utf8 fileName=${fileName} mimeType=${mimeType} size=${buf.length} textLen=${text.length} dur=${Date.now()-t0}ms`);
    return new Response(JSON.stringify({ text, method: 'binary-utf8' }), { headers });
  } catch (err) {
    console.error('[ExtractText] error:', err);
    console.warn(`[extract-text] 500 fileName=${body?.fileName} mimeType=${body?.mimeType} dur=${Date.now()-t0}ms`);
    return new Response(JSON.stringify({ error: 'extract failed', details: String(err) }), { status: 500, headers });
  }
};
