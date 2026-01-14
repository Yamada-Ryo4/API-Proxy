export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 🔴 根路径检查 ===
    if (url.pathname === "/") {
      return new Response("Claude Proxy is running...", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    // 1. 处理 CORS (预检请求)
    // 注意：Claude 需要允许特定的自定义 Header (x-api-key, anthropic-version)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          // 必须包含 Claude 特有的 Header，否则浏览器会报错
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. 核心配置：指向 Anthropic
    url.hostname = "api.anthropic.com";
    url.protocol = "https:";
    url.port = "";

    // === 关键修改：克隆并清洗 Headers ===
    const newHeaders = new Headers(request.headers);
    
    // 强制修改 Host
    newHeaders.set("Host", "api.anthropic.com");
    // 设置 Origin，防止被拒绝
    newHeaders.set("Origin", "https://api.anthropic.com");
    
    // 移除 Cloudflare 隐私头
    newHeaders.delete("Cf-Connecting-Ip");
    newHeaders.delete("Cf-Ipcountry");
    newHeaders.delete("X-Forwarded-For");
    newHeaders.delete("X-Real-Ip");

    // === 3. 发送请求 ===
    // Claude 目前主要使用标准的 HTTP POST 流式传输 (SSE)，没有 WebSocket
    const hasBody = !['GET', 'HEAD'].includes(request.method);
    
    const newRequest = new Request(url, {
      method: request.method,
      headers: newHeaders,
      body: hasBody ? request.body : null,
      redirect: "follow"
    });

    try {
      const response = await fetch(newRequest);
      
      // 重构 Response 以添加 CORS 头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      return newResponse;
    } catch (e) {
      return new Response("Claude Proxy Error: " + e.message, { status: 500 });
    }
  },
};
