// Netlify Function: DeepSeek chat proxy (non-streaming)
// Reads messages from request body and forwards to DeepSeek API.

export default async (req, context) => {
  try {
    const API_KEY = process.env.DEEPSEEK_API_KEY;
    const API_URL = 'https://api.deepseek.com/v1/chat/completions';

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bodyText = await req.text();
    let payload = {};
    try {
      payload = JSON.parse(bodyText || '{}');
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { messages, model = 'deepseek-chat', temperature = 0.7 } = payload || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });

    const text = await response.text();
    const status = response.status;
    return new Response(text, {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Netlify Function v1 (CommonJS) for maximum compatibility
// Handles CORS, timeout, and proxies to DeepSeek non-streaming API.

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

exports.handler = async function(event, context) {
  try {
    const API_KEY = process.env.DEEPSEEK_API_KEY;
    const headersBase = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: headersBase, body: '' };
    }

    if (!API_KEY) {
      return {
        statusCode: 500,
        headers: headersBase,
        body: JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY' })
      };
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: headersBase,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    const { messages, model = 'deepseek-chat', temperature = 0.7 } = payload || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers: headersBase,
        body: JSON.stringify({ error: 'messages must be a non-empty array' })
      };
    }

    // 8s timeout to avoid Netlify 504 (max ~10s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model, messages, temperature, stream: false }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const aborted = String(err && err.name).includes('AbortError');
      return {
        statusCode: 504,
        headers: headersBase,
        body: JSON.stringify({ error: aborted ? 'Upstream timeout' : 'Fetch error', details: String(err) })
      };
    }

    clearTimeout(timeout);

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: headersBase,
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Proxy error', details: String(err) })
    };
  }
};
