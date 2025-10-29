// Netlify Edge Function (Deno) — DeepSeek Taxonomy
// 提供行业列表与指定行业的岗位列表，统一返回 JSON
export default async (request, context) => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, accept",
  });
  if (request.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "industries"; // industries | positions
  const industry = url.searchParams.get("industry") || "";

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }), { status: 500, headers });
  }

  const upstreamUrl = "https://api.deepseek.com/v1/chat/completions";

  // 兜底数据（避免模型不可用时影响前端体验）
  const FALLBACK_INDUSTRIES = [
    "人工智能","互联网","金融科技","生物医药","新能源","航空航天","电子通信","机械制造","化工材料","土木建筑","环境工程","教育",
    "医疗健康","物流供应链","零售电商","文化传媒","游戏","汽车制造","半导体","云计算","大数据","网络安全","法律服务","咨询",
    "人力资源","房地产/物业","酒店旅游","餐饮服务","农业科技","公共服务/政府","保险","银行","证券","广告营销","内容创作",
    "体育与健身","互联网金融","跨境电商"
  ];
  const FALLBACK_POSITIONS = {
    "人工智能": ["AI产品经理","机器学习工程师","算法工程师","数据科学家","AI研究员","计算机视觉工程师","自然语言处理工程师","芯片研发工程师"],
    "互联网": ["产品经理","前端工程师","后端工程师","全栈工程师","UI/UX设计师","运营专员","数据分析师","测试工程师"],
    "金融科技": ["量化分析师","风控专员","金融产品经理","区块链工程师","投资顾问","财务分析师","合规专员","金融数据分析师"],
    "生物医药": ["生物信息工程师","药物研发工程师","临床研究员","医疗器械工程师","生物统计师","药事专员","质量控制专员","医学编辑"],
    "新能源": ["电池工程师","新能源汽车工程师","光伏工程师","储能系统工程师","充电桩工程师","能源管理师","电力系统工程师","新材料研发工程师"],
    "航空航天": ["航空发动机工程师","飞行器设计工程师","航天器结构工程师","导航控制工程师","航空材料工程师","卫星通信工程师","火箭推进工程师","航空电子工程师"],
    "电子通信": ["射频工程师","通信协议工程师","5G网络工程师","信号处理工程师","嵌入式工程师","硬件设计工程师","天线设计工程师","光通信工程师"],
    "机械制造": ["机械设计工程师","工艺工程师","自动化工程师","精密制造工程师","模具设计工程师","数控编程工程师","质量工程师","设备维护工程师"],
    "化工材料": ["化工工艺工程师","材料研发工程师","高分子材料工程师","催化剂工程师","环保工程师","安全工程师","分析化学工程师","纳米材料工程师"],
    "土木建筑": ["结构工程师","建筑设计师","岩土工程师","道路桥梁工程师","建筑施工工程师","BIM工程师","工程造价师","城市规划师"],
    "环境工程": ["环境监测工程师","污水处理工程师","大气治理工程师","固废处理工程师","环境影响评价师","碳排放管理师","生态修复工程师","清洁生产工程师"],
    "教育": ["教师","教研员","班主任","培训师","教育产品经理"]
  };

  const parseJson = (text) => {
    try {
      const cleaned = String(text).trim().replace(/^```json|^```|```$/g, "");
      const obj = JSON.parse(cleaned);
      return obj;
    } catch (_) {
      return null;
    }
  };

  try {
    const sys = "你是中国职业分类专家。只返回纯JSON，不要代码块或解释。";
    const user = kind === "industries"
      ? "请给出中国语境的行业分类列表，最多60项。JSON对象结构：{\"industries\": [{\"id\": string, \"name\": string, \"aliases\": string[]}] }。行业名称规范、去重。"
      : `请列出行业“${industry}”的常见岗位/二级行业，最多60项。JSON对象结构：{\"industry\": string, \"positions\": [{\"id\": string, \"name\": string}] }。岗位名称贴合中国职场。`;

    const init = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        stream: false,
      }),
    };

    const upstreamRes = await fetch(upstreamUrl, init);
    if (!upstreamRes.ok) {
      throw new Error(await upstreamRes.text());
    }
    const data = await upstreamRes.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const json = parseJson(content);

    if (kind === "industries") {
      const arr = Array.isArray(json?.industries) ? json.industries : null;
      if (!arr || !arr.length) throw new Error("invalid industries json");
      const names = arr.map((x) => x?.name || x).filter(Boolean);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ industries: names, source: "deepseek" }), { headers });
    } else {
      const arr = Array.isArray(json?.positions) ? json.positions : null;
      if (!arr || !arr.length) throw new Error("invalid positions json");
      const names = arr.map((x) => x?.name || x).filter(Boolean);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ industry, positions: names, source: "deepseek" }), { headers });
    }
  } catch (err) {
    // Fallback
    headers.set("Content-Type", "application/json");
    if (kind === "industries") {
      return new Response(JSON.stringify({ industries: FALLBACK_INDUSTRIES, source: "fallback" }), { headers });
    } else {
      const list = FALLBACK_POSITIONS[industry] || [
        "产品经理","项目经理","数据分析师","运营专员","销售顾问","市场专员","客户成功经理"
      ];
      return new Response(JSON.stringify({ industry, positions: list, source: "fallback" }), { headers });
    }
  }
};

export const config = { path: "/deepseek-taxonomy" };

