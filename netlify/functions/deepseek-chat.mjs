import https from 'node:https';

export default async (req, context) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // 仅允许 POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  // 读取 body
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers,
    });
  }

  const { messages, model = 'deepseek-chat', temperature = 0.7 } = body;
  if (!Array.isArray(messages) || !messages.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers,
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY' }), {
      status: 500,
      headers,
    });
  }

  // 组装上游请求体
  const upstreamBody = JSON.stringify({ model, messages, temperature, stream: false });

  // 8 秒超时 + Promise.race
  const upstreamPromise = new Promise((resolve, reject) => {
    const post = https.request(
      {
        hostname: 'api.deepseek.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(upstreamBody),
        },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`DeepSeek ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    post.on('error', reject);
    post.on('timeout', () => reject(new Error('Upstream timeout')));
    post.write(upstreamBody);
    post.end();
  });

  try {
    const raw = await upstreamPromise;
    return new Response(raw, { headers });
  } catch (err) {
    console.error('DeepSeek error:', err);
    return new Response(
      JSON.stringify({ error: 'DeepSeek API error', detail: err.message }),
      { status: 502, headers }
    );
  }
};