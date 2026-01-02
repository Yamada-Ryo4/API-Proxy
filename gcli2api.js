/**
 * Google Cloud Code All-in-One Proxy (Perfect Edition)
 * Based on Gemini Proxy Logic
 */

// === 1. 上游配置表 ===
// key: URL前缀 (必须以/开头)
// value: 目标真实域名
const UPSTREAM_MAP = {
  '/codeassist':      'cloudcode-pa.googleapis.com',           // Code Assist
  '/oauth':           'oauth2.googleapis.com',                 // OAuth2
  '/googleapis':      'www.googleapis.com',                    // Google APIs
  '/resourcemanager': 'cloudresourcemanager.googleapis.com',   // Resource Manager
  '/serviceusage':    'serviceusage.googleapis.com',           // Service Usage
  '/antigravity':     'daily-cloudcode-pa.sandbox.googleapis.com' // Antigravity (Sandbox)
};

// 默认上游（当不使用任何前缀时，默认走的路线，建议设为最高频使用的 Code Assist）
const DEFAULT_UPSTREAM = 'cloudcode-pa.googleapis.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 🔴 安全补丁：拦截根路径 ===
    // 方便验证 Worker 是否存活
    if (url.pathname === "/") {
      return new Response("Google Cloud Code Proxy is running...", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    // === 2. 全局 CORS 处理 (HTTP OPTIONS) ===
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // === 3. 核心路由逻辑：确定目标域名和路径 ===
    let targetHostname = DEFAULT_UPSTREAM;
    let requestPath = url.pathname;

    // 遍历配置表，检查是否匹配前缀
    for (const [prefix, upstream] of Object.entries(UPSTREAM_MAP)) {
      if (requestPath.startsWith(prefix)) {
        targetHostname = upstream;
        // 移除前缀，恢复原始路径。例如 /oauth/token -> /token
        requestPath = requestPath.replace(prefix, "");
        // 防止路径为空
        if (requestPath === "" || !requestPath.startsWith("/")) {
          requestPath = "/" + requestPath;
        }
        break;
      }
    }

    // 重构目标 URL
    url.hostname = targetHostname;
    url.pathname = requestPath;
    url.protocol = "https:";
    url.port = "";

    // === 4. 关键修改：深度清洗并伪造 Headers ===
    const newHeaders = new Headers(request.headers);

    // A. 身份伪装：骗过 Google 服务器校验
    newHeaders.set("Host", targetHostname);
    newHeaders.set("Origin", `https://${targetHostname}`);
    newHeaders.set("Referer", `https://${targetHostname}${requestPath}`);

    // B. 隐私保护：移除 Cloudflare 代理特征
    const headersToDelete = [
      "Cf-Connecting-Ip", 
      "Cf-Ipcountry", 
      "Cf-Ray", 
      "Cf-Visitor", 
      "X-Forwarded-For", 
      "X-Forwarded-Proto", 
      "X-Real-Ip"
    ];
    headersToDelete.forEach(h => newHeaders.delete(h));

    // === 5. WebSocket (Live API) 支持 ===
    // 虽然目前 Cloud Code 主要用 REST，但保留此逻辑以备不时之需
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const newRequest = new Request(url, {
        method: request.method,
        headers: newHeaders,
        redirect: "follow"
      });

      try {
        const response = await fetch(newRequest);
        return response; 
      } catch (e) {
        return new Response("WebSocket Proxy Error: " + e.message, { status: 500 });
      }
    }

    // === 6. 常规 HTTP 请求转发 ===
    const newRequest = new Request(url, {
      method: request.method,
      headers: newHeaders,
      body: request.body, // POST/PUT 时透传 Body
      redirect: "follow"
    });

    try {
      const response = await fetch(newRequest);
      
      // === 7. 响应头处理 ===
      // 重构 Response 以确保 CORS 依然生效，并透传内容
      const newResponse = new Response(response.body, response);
      
      // 强制覆盖 CORS 头，允许前端调用
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Expose-Headers", "*");
      
      // 移除可能导致浏览器安全策略报错的头 (可选)
      // newResponse.headers.delete("Content-Security-Policy"); 

      return newResponse;
    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  },
};
