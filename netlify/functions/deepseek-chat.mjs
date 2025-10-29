export default async (req, context) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, accept',
  };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors, status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors });
  }

  const { messages, model = 'deepseek-chat', temperature = 0.7, stream = false } = body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400, headers: cors });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY' }), { status: 500, headers: cors });
  }

  const upstreamUrl = 'https://api.deepseek.com/v1/chat/completions';

  if (stream) {
    // 支持 SSE 流式：快速发送心跳，透传上游事件，降低超时概率
    const headers = new Headers(cors);
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');

    const streamBody = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        // 立即心跳，兼容客户端 data: 解析
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));

        const aborter = new AbortController();
        const timeoutMs = 12000; // 12s 尝试给上游更充裕时间
        const t = setTimeout(() => aborter.abort(), timeoutMs);

        let upstreamRes;
        try {
          upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({ model, messages, temperature, stream: true }),
            signal: aborter.signal,
          });
        } catch (err) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'fetch_failed', message: String(err) })}\n\n`));
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
          controller.close();
          clearTimeout(t);
          return;
        }

        clearTimeout(t);

        if (!upstreamRes.ok) {
          const text = await upstreamRes.text().catch(() => '');
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'deepseek_error', status: upstreamRes.status, detail: text })}\n\n`));
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }

        const reader = upstreamRes.body?.getReader();
        if (!reader) {
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }

        const heartbeat = setInterval(() => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ ping: true })}\n\n`)); } catch {}
        }, 9000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      }
    });

    return new Response(streamBody, { headers });
  }

  // 非流式：直接返回 JSON
  const aborter = new AbortController();
  const timeoutMs = 12000; // 12s
  const t = setTimeout(() => aborter.abort(), timeoutMs);
  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
      signal: aborter.signal,
    });
    clearTimeout(t);

    const text = await upstreamRes.text();
    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ error: 'DeepSeek error', detail: text }), { status: upstreamRes.status, headers: cors });
    }
    return new Response(text, { headers: { ...cors, 'Content-Type': 'application/json' }, status: upstreamRes.status });
  } catch (err) {
    const detail = err?.name === 'AbortError' ? 'Upstream timeout' : String(err?.message || err);
    return new Response(JSON.stringify({ error: 'DeepSeek API error', detail }), { status: 502, headers: cors });
  }
};
