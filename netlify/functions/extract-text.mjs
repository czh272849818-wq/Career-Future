// 按需动态加载依赖，避免在未安装依赖时顶层初始化失败导致 502

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4;

// Netlify Node Function: 文本提取（支持 TXT / DOCX / DOC / PDF / XLSX / CSV / 图片OCR / MP4元数据）
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

  const contentType = req.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');
  let body;
  let formFile;
  if (isMultipart) {
    try {
      const formData = await req.formData();
      formFile = formData.get('file');
      if (!formFile || typeof formFile === 'string') {
        return new Response(JSON.stringify({ error: 'missing file' }), { status: 400, headers });
      }
      if (formFile.size > MAX_FILE_BYTES) {
        return new Response(JSON.stringify({ error: 'file too large', maxBytes: MAX_FILE_BYTES }), { status: 413, headers });
      }
      body = {
        fileName: formFile.name || '',
        mimeType: formFile.type || '',
        dataBase64: Buffer.from(await formFile.arrayBuffer()).toString('base64')
      };
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid multipart form data', details: String(err) }), { status: 400, headers });
    }
  } else {
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }
  }

  const t0 = Date.now();
  try {
    const { fileName = '', mimeType = '', dataBase64 = '' } = body || {};
    if (!dataBase64) {
      console.warn(`[extract-text] 400 missing dataBase64 fileName=${fileName} mimeType=${mimeType}`);
      return new Response(JSON.stringify({ error: 'missing dataBase64' }), { status: 400, headers });
    }
    if (String(dataBase64).length > MAX_BASE64_LENGTH) {
      return new Response(JSON.stringify({ error: 'file too large', maxBytes: MAX_FILE_BYTES }), { status: 413, headers });
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
    if (!supported) {
      return new Response(JSON.stringify({ error: 'unsupported file type' }), { status: 415, headers });
    }

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

    // MP4 仅返回文件摘要，避免把二进制误读成文本
    if (mimeType === 'video/mp4' || lowerName.endsWith('.mp4')) {
      const text = `[视频附件] ${fileName}，大小 ${(buf.length / 1024 / 1024).toFixed(2)} MB。当前仅提取元信息，未做音视频转写。`;
      return new Response(JSON.stringify({ text, method: 'mp4-meta' }), { headers });
    }

    // CSV / XLSX
    if (lowerName.endsWith('.csv') || mimeType.includes('csv')) {
      const text = buf.toString('utf-8');
      return new Response(JSON.stringify({ text, method: 'csv' }), { headers });
    }
    if (lowerName.endsWith('.xlsx') || mimeType.includes('spreadsheetml.sheet') || lowerName.endsWith('.xls')) {
      try {
        const xlsxModule = await import('xlsx');
        const XLSX = xlsxModule.default || xlsxModule;
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheet = workbook.SheetNames[0];
        const json = sheet ? XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 }) : [];
        const text = Array.isArray(json) ? json.map(row => Array.isArray(row) ? row.join('\t') : String(row)).join('\n') : '';
        return new Response(JSON.stringify({ text, method: 'xlsx' }), { headers });
      } catch (xlsxErr) {
        console.warn('[XLSX] parse failed:', xlsxErr);
        return new Response(JSON.stringify({ error: 'xlsx parse failed', details: String(xlsxErr) }), { status: 500, headers });
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
        return new Response(JSON.stringify({ error: 'docx parse failed' }), { status: 422, headers });
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
        console.warn('[DOC] parse failed:', docErr);
        return new Response(JSON.stringify({ error: 'doc parse failed' }), { status: 422, headers });
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
          return new Response(JSON.stringify({ error: 'pdf parse failed' }), { status: 422, headers });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'unsupported file type' }), { status: 415, headers });
  } catch (err) {
    console.error('[ExtractText] error:', err);
    console.warn(`[extract-text] 500 fileName=${body?.fileName} mimeType=${body?.mimeType} dur=${Date.now()-t0}ms`);
    return new Response(JSON.stringify({ error: 'extract failed', details: String(err) }), { status: 500, headers });
  }
};

export { MAX_FILE_BYTES };
