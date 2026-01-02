export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 🔴 安全补丁：拦截根路径 (防止红屏的关键) ===
    // 只要是访问首页，直接返回纯文字，不要转发给 Google
    if (url.pathname === "/") {
      return new Response("Gemini-OpenAI Compatible Proxy is running...", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }
    // ===============================================

    // 1. 处理 CORS 预检 (允许跨域)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // 2. 定义目标域名
    url.hostname = "generativelanguage.googleapis.com";
    url.protocol = "https:"; 

    // 3. 关键步骤：路径重写
    // 客户端软件通常请求的是 /v1/chat/completions
    // 我们需要把它修改为 Google 的兼容路径 /v1beta/openai/chat/completions
    if (url.pathname.startsWith("/v1/")) {
      url.pathname = url.pathname.replace("/v1/", "/v1beta/openai/");
    }

    // 4. 构建新请求
    // 使用显式参数构建 Request 对象通常比直接传 request 更稳定
    const newRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'POST' ? request.body : null,
      redirect: "follow"
    });

    try {
      const response = await fetch(newRequest);

      // 5. 处理响应
      // 直接透传 Google 的响应（包括 SSE 流式数据）
      const newResponse = new Response(response.body, response);
      
      // 补上 CORS 头，防止浏览器端报错
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      return newResponse;

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
