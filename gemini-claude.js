export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 基础响应与 CORS
    if (url.pathname === "/") {
      return new Response("Gemini Adapter (Claude Protocol) Running...", { status: 200 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Headers": "*",
        }
      });
    }

    try {
      // 2. 鉴权：提取 API Key
      // 优先取 x-api-key (Claude 标准)，其次取 Authorization
      const apiKey = request.headers.get("x-api-key") || 
                     request.headers.get("authorization")?.replace("Bearer ", "");
      
      if (!apiKey) {
        return new Response(JSON.stringify({
          type: "error",
          error: { type: "authentication_error", message: "Missing API Key" }
        }), { status: 401 });
      }

      // 3. 解析 Claude 请求体
      const claudeBody = await request.json();
      
      // === 严格模式：直接使用客户端传的模型名 ===
      // 客户端必须传 "gemini-1.5-pro" 等有效名字，传 "claude-3" 会报错
      const model = claudeBody.model; 
      const isStream = claudeBody.stream || false;

      // 4. 构建 Gemini 请求体 (格式转换)
      const geminiBody = {
        contents: transformMessagesToGemini(claudeBody.messages),
        generationConfig: {
          temperature: claudeBody.temperature,
          maxOutputTokens: claudeBody.max_tokens,
          topP: claudeBody.top_p,
          topK: claudeBody.top_k,
          stopSequences: claudeBody.stop_sequences
        },
        // 默认放宽安全限制，防止拒答
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      };

      // 提取 System Prompt (Claude 是顶层字段 -> Gemini 是 system_instruction)
      if (claudeBody.system) {
        geminiBody.system_instruction = {
          parts: [{ text: claudeBody.system }]
        };
      }

      // 5. 发起请求
      const method = isStream ? "streamGenerateContent" : "generateContent";
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}`;

      const googleRes = await fetch(googleUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody)
      });

      // 处理 Google 报错
      if (!googleRes.ok) {
        const errorText = await googleRes.text();
        return new Response(errorText, { status: googleRes.status, headers: { "Content-Type": "application/json" } });
      }

      // 6. 响应转换 (Gemini -> Claude)
      if (isStream) {
        return handleStreamResponse(googleRes, model);
      } else {
        return handleNormalResponse(googleRes, model);
      }

    } catch (e) {
      return new Response(JSON.stringify({ 
        type: "error", 
        error: { type: "api_error", message: e.message } 
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },
};

// === 辅助逻辑：非流式响应 ===
async function handleNormalResponse(response, model) {
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || "";
  
  // 映射停止原因
  const stopReason = mapFinishReason(candidate?.finishReason);

  const claudeResp = {
    id: "msg_" + Date.now(), // 伪造 ID
    type: "message",
    role: "assistant",
    model: model,
    content: [{ type: "text", text: text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0
    }
  };

  return new Response(JSON.stringify(claudeResp), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// === 辅助逻辑：流式响应 (最关键部分) ===
function handleStreamResponse(response, model) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 立即发送头部事件
  const msgId = "msg_" + Date.now();
  
  // 封装发送函数
  const sendEvent = async (event, data) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  // 启动流处理
  (async () => {
    try {
      // 1. message_start
      await sendEvent("message_start", {
        type: "message_start",
        message: {
          id: msgId,
          type: "message",
          role: "assistant",
          model: model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      });

      // 2. content_block_start
      await sendEvent("content_block_start", {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" }
      });

      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Gemini 的流式返回是一个个包含 JSON 对象的片段，通常以 ",\r\n" 分割，或者就是单独的 JSON 对象
        // 这里的处理逻辑需要能够容错，提取 "text" 字段
        
        // 简单提取逻辑：查找所有 "text": "..." 模式
        // 为了处理转义字符，使用稍微复杂的正则，或者简单的字符串切分
        // 注意：Gemini 有时返回的不是标准 JSON 数组，而是多段 JSON
        
        // 尝试按行处理，如果该行包含 payload
        const lines = buffer.split("\n");
        buffer = lines.pop(); // 保留最后一行可能是半截的数据

        for (const line of lines) {
            const trimmed = line.trim().replace(/^,/, ''); // 去掉开头的逗号
            if (!trimmed) continue;
            if (trimmed === '[' || trimmed === ']') continue;

            try {
                const chunk = JSON.parse(trimmed);
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    await sendEvent("content_block_delta", {
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "text_delta", text: text }
                    });
                }
                // 处理 usageMetadata (通常在最后一块)
                if (chunk.usageMetadata) {
                     // 可以在这里存储 usage，但 Claude 流式协议通常不实时更新 usage，只在最后 message_delta 发送
                }
            } catch (e) {
                // 解析失败忽略，等待更多数据拼凑
            }
        }
      }

      // 3. content_block_stop
      await sendEvent("content_block_stop", {
        type: "content_block_stop",
        index: 0
      });

      // 4. message_delta (包含 usage 和 stop_reason)
      await sendEvent("message_delta", {
        type: "message_delta",
        delta: {
            stop_reason: "end_turn",
            stop_sequence: null
        },
        usage: { output_tokens: 0 } // Gemini 流式很难实时算 token，这里置 0 或留空
      });

      // 5. message_stop
      await sendEvent("message_stop", { type: "message_stop" });

      await writer.close();

    } catch (e) {
      // 发生错误尝试通知客户端
      try {
        await sendEvent("error", { type: "error", error: { type: "api_error", message: e.message } });
        await writer.close();
      } catch (_) {}
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// === 转换请求 Message ===
function transformMessagesToGemini(messages) {
  return messages.map(msg => {
    // 角色映射
    const role = msg.role === "assistant" ? "model" : "user";
    
    // 内容提取
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      // 拼接所有 text 类型的片段
      text = msg.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join("\n");
    }

    return {
      role: role,
      parts: [{ text: text }]
    };
  });
}

// === 映射停止原因 ===
function mapFinishReason(reason) {
  if (!reason) return null;
  switch (reason) {
    case "STOP": return "end_turn";
    case "MAX_TOKENS": return "max_tokens";
    case "SAFETY": return "stop_sequence"; // 视为一种强制停止
    default: return "end_turn";
  }
}
