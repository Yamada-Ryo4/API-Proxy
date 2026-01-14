export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 🔴 根路径检查 ===
    // 当直接访问域名时，返回一个提示，而不是错误
    if (url.pathname === "/") {
      return new Response("OpenAI Proxy (HTTP + WS) is running...", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    // 1. 处理 CORS (预检请求)
    // 允许前端直接调用，解决跨域问题
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // 2. 核心配置：指向 OpenAI
    url.hostname = "api.openai.com";
    url.protocol = "https:";
    url.port = "";

    // === 关键修改：克隆并清洗 Headers ===
    const newHeaders = new Headers(request.headers);
    
    // 强制修改 Host，通过 OpenAI 的域名校验
    newHeaders.set("Host", "api.openai.com");
    // 将 Origin 设置为 OpenAI 官网，防止触发跨域安全策略
    newHeaders.set("Origin", "https://api.openai.com");
    
    // 移除 Cloudflare 边缘节点添加的 Header，保护隐私并减少被检测风险
    newHeaders.delete("Cf-Connecting-Ip");
    newHeaders.delete("Cf-Ipcountry");
    newHeaders.delete("X-Forwarded-For");
    newHeaders.delete("X-Real-Ip");
    
    // 如果你需要硬编码 Key (不推荐，建议客户端传)，可以在这里设置：
    // if (!newHeaders.has("Authorization")) {
    //   newHeaders.set("Authorization", "Bearer sk-your-key-here");
    // }

    // === 🔵 WebSocket (Realtime API) 支持 ===
    // 适用于 wss://api.openai.com/v1/realtime
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const newRequest = new Request(url, {
        method: request.method,
        headers: newHeaders,
        redirect: "follow"
      });

      try {
        // Cloudflare Workers 原生支持 WebSocket 握手转发
        const response = await fetch(newRequest);
        return response; 
      } catch (e) {
        return new Response("WebSocket Proxy Error: " + e.message, { status: 500 });
      }
    }

    // === 3. 常规 HTTP 请求 (Chat/Audio/Files 等) ===
    // 更加严谨的 Body 处理，防止 GET 请求带 Body 报错
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
      // 必须重新构建 Response，因为原始 Response 的 headers 是只读的
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      return newResponse;
    } catch (e) {
      return new Response("API Proxy Error: " + e.message, { status: 500 });
    }
  },
};
