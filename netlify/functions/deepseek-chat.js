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
