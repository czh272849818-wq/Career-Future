// Netlify Edge Function (Deno) – 30 s 超时，支持 SSE 流式
export default async (request, context) => {
  // CORS
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
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

  // 向上游发起流式请求
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

  // 流式透传
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(upstreamRes.body, { headers });
};

export const config = { path: "/deepseek-chat-edge" };