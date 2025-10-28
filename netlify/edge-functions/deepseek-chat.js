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

  // 向上游发起请求（根据 stream 决定是否流式）
  const upstreamRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, stream }),
  });

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return new Response(JSON.stringify({ error: "DeepSeek error", detail: text }), {
      status: upstreamRes.status,
      headers,
    });
  }

  if (stream) {
    // 流式透传（SSE）
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("X-Accel-Buffering", "no");
    headers.set("Connection", "keep-alive");

    // 明确通过 ReadableStream 透传，减少中间层意外关闭
    const reader = upstreamRes.body?.getReader();
    const streamBody = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      }
    });
    return new Response(streamBody, { headers });
  }

  // 非流式：返回 JSON
  const jsonText = await upstreamRes.text();
  headers.set("Content-Type", "application/json");
  return new Response(jsonText, { headers, status: upstreamRes.status });
};

export const config = { path: "/deepseek-chat" };
