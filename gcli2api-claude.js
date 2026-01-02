export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. 动态判断上游基础地址
    let upstreamBase = "https://your-domain.com";
    if (path.startsWith("/antigravity")) {
      upstreamBase = "https://your-domain.com/antigravity";
    }

    // --- 新增：处理获取模型列表的请求 (GET /v1/models) ---
    if (request.method === "GET" && (path.endsWith("/models") || path.includes("/models"))) {
      const authHeader = request.headers.get("x-api-key") || request.headers.get("Authorization");
      const newHeaders = new Headers();
      if (authHeader) {
        newHeaders.set("Authorization", `Bearer ${authHeader.replace("Bearer ", "")}`);
      }
      
      // 转发给 OpenAI 格式的模型列表接口
      const modelResponse = await fetch(`${upstreamBase}/v1/models`, {
        method: "GET",
        headers: newHeaders
      });
      return modelResponse; // 直接返回 OpenAI 格式的模型列表
    }

    // --- 原有：处理对话请求 (POST /v1/messages) ---
    if (request.method === "POST") {
      try {
        const anthropicBody = await request.json();
        
        // 提取模型：优先使用请求里的，如果没有则 fallback
        const targetModel = anthropicBody.model || "claude-3-5-sonnet";

        const openaiBody = {
          model: targetModel, 
          messages: [],
          stream: anthropicBody.stream ?? true,
          max_tokens: anthropicBody.max_tokens || 4096,
          temperature: anthropicBody.temperature || 1
        };

        // 协议转换 (System Prompt)
        if (anthropicBody.system) {
          openaiBody.messages.push({ role: "system", content: anthropicBody.system });
        }
        if (anthropicBody.messages) {
          openaiBody.messages.push(...anthropicBody.messages);
        }

        // Header 转换
        const authHeader = request.headers.get("x-api-key") || request.headers.get("Authorization");
        const newHeaders = new Headers();
        newHeaders.set("Content-Type", "application/json");
        if (authHeader) {
          newHeaders.set("Authorization", `Bearer ${authHeader.replace("Bearer ", "")}`);
        }

        const response = await fetch(`${upstreamBase}/v1/chat/completions`, {
          method: "POST",
          headers: newHeaders,
          body: JSON.stringify(openaiBody)
        });

        // 根据 Claude Code 需求返回响应
        if (anthropicBody.stream) {
          return new Response(response.body, {
            status: response.status,
            headers: { "Content-Type": "text/event-stream" }
          });
        } else {
          const data = await response.json();
          const anthropicResponse = {
            id: data.id,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: data.choices[0]?.message?.content || "" }],
            model: data.model,
            usage: {
              input_tokens: data.usage?.prompt_tokens || 0,
              output_tokens: data.usage?.completion_tokens || 0
            }
          };
          return new Response(JSON.stringify(anthropicResponse), {
            headers: { "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
