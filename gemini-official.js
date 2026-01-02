export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 🔴 安全补丁：拦截根路径 ===
    if (url.pathname === "/") {
      return new Response("Gemini Proxy (HTTP + WS) is running...", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    // 1. 处理 CORS (HTTP OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // 2. 核心配置：目标重定向
    url.hostname = "generativelanguage.googleapis.com";
    url.protocol = "https:"; // 无论是 HTTP 还是 WS，CF fetch 都走 https 握手
    url.port = "";

    // === 关键修改：克隆并清洗 Headers ===
    // 必须创建一个新的 Headers 对象，否则有些只读 Header 无法修改
    const newHeaders = new Headers(request.headers);
    
    // 强制设置 Host，骗过 Google 的服务器校验
    newHeaders.set("Host", "generativelanguage.googleapis.com");
    newHeaders.set("Origin", "https://generativelanguage.googleapis.com"); // 部分 Google API 检查 Origin
    
    // 移除可能暴露代理身份的 Header (可选，增强隐私)
    newHeaders.delete("Cf-Connecting-Ip");
    newHeaders.delete("Cf-Ipcountry");
    newHeaders.delete("X-Forwarded-For");
    newHeaders.delete("X-Real-Ip");

    // === 🔵 WebSocket (Live API) 支持 ===
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const newRequest = new Request(url, {
        method: request.method,
        headers: newHeaders, // 使用处理过的 Headers
        redirect: "follow"
      });

      try {
        // Cloudflare 会自动处理协议升级
        const response = await fetch(newRequest);
        return response; 
      } catch (e) {
        return new Response("WebSocket Proxy Error: " + e.message, { status: 500 });
      }
    }

    // === 3. 常规 HTTP 请求 (对话/画图) ===
    const newRequest = new Request(url, {
      method: request.method,
      headers: newHeaders, // 使用处理过的 Headers
      body: request.method === 'POST' ? request.body : null,
      redirect: "follow"
    });

    try {
      const response = await fetch(newRequest);
      
      // 重构 Response 以添加 CORS 头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      return newResponse;
    } catch (e) {
      return new Response("API Proxy Error: " + e.message, { status: 500 });
    }
  },
};
