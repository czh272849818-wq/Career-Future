// Netlify Edge Function (Deno) – 30 s 超时，支持 SSE 流式
export default async (request, context) => {
  // CORS
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, accept",
  });
  if (request.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || !body.messages.length) {
    return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }), { status: 500, headers });
  }

  const { messages, model = "deepseek-chat", temperature = 0.7, stream = true } = body;
  const upstreamUrl = "https://api.deepseek.com/v1/chat/completions";
  const upstreamInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, stream }),
  };

  if (stream) {
    // 流式透传（SSE）：先返回响应，再在流中异步发起上游请求，减少首字节等待导致的超时
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("X-Accel-Buffering", "no");
    headers.set("Connection", "keep-alive");

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // 立即发送心跳（SSE 注释行）
        controller.enqueue(encoder.encode(":\n\n"));

        let upstreamRes;
        try {
          upstreamRes = await fetch(upstreamUrl, upstreamInit);
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "fetch_failed", message: String(err) })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }

        if (!upstreamRes.ok) {
          const text = await upstreamRes.text().catch(() => "");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "deepseek_error", status: upstreamRes.status, detail: text })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }

        const reader = upstreamRes.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }

        // 定期心跳，防止链路中断与中间层缓冲
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":\n\n"));
          } catch (_) {}
        }, 10000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          // 结束标记
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      }
    });
    return new Response(streamBody, { headers });
  }

  // 非流式：返回 JSON
  const upstreamRes = await fetch(upstreamUrl, upstreamInit);
  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return new Response(JSON.stringify({ error: "DeepSeek error", detail: text }), {
      status: upstreamRes.status,
      headers,
    });
  }
  const jsonText = await upstreamRes.text();
  headers.set("Content-Type", "application/json");
  return new Response(jsonText, { headers, status: upstreamRes.status });
};

export const config = { path: "/deepseek-chat" };
