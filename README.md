# 🌐 API-Proxy (Cloudflare Workers 版)

[![Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

本项目提供了一套**零成本、高性能**的 API 代理解决方案，专为解决中国大陆直连 Google Gemini API 的网络限制而设计。利用 Cloudflare 全球边缘节点，实现极速响应与稳定连接。

---

## ⚠️ 网络连接重要提示 (必读)

> [!WARNING]
> **关于 workers.dev 域名的访问限制**
> Cloudflare 分配的默认域名（例如 `xxx.workers.dev`）在中国大陆通常无法直接访问。
> **为了确保服务可用，部署 Worker 后请务必在后台绑定自己的自定义域名。**

* **有域名：** 直接在 Cloudflare Worker 设置中绑定二级域名（如 `api.yourdomain.com`）。
* **无域名：** 可以尝试使用免费域名服务（如 `pp.ua`、`eu.org` 等）。

---

## 📂 脚本功能速查

请根据您的具体使用场景，在 `/scripts` 目录下选择对应的代码进行部署：

| 脚本文件 | 核心功能 | 适用场景 / 客户端 | 复杂度 |
| :--- | :--- | :--- | :--- |
| `gemini-official.js` | 🛡️ **官方直连代理** | 官方 SDK、Web 应用、WebSocket (Live API) | ⭐️ |
| `gemini-oai.js` | 🔄 **OpenAI 格式转换** | NextChat, LobeChat, 沉浸式翻译等 | ⭐️ |
| `gcli2api.js` | 🌉 **GCLI 路由网关** | 配合 `su-kaka/gcli2api` 后端使用 | ⭐️⭐️ |
| `gcli2api-claude.js` | 🔌 **Claude 协议适配** | 让 `claude-code` 等工具调用 Google 模型 | ⭐️⭐️ |

---

## 🚀 核心功能详解

### 1. 官方接口直连 (`gemini-official.js`)

最纯粹的透明代理，忠实转发所有请求，支持最新的 WebSocket 实时协议。

* **✅ 适用场景：**
    * 开发使用 Google 官方 SDK (Python/Node.js) 的应用。
    * 体验 Gemini live 的 **Multimodal Live API** (实时语音/视频)。
* **🛠️ 部署步骤：**
    1. 在 Cloudflare 创建 Worker，粘贴脚本代码。
    2. **必须** 绑定自定义域名。
* **💻 使用方式：**
    将 API 基地址从 `generativelanguage.googleapis.com` 替换为您的自定义域名。

```javascript
// 示例：Node.js SDK 配置
const genAI = new GoogleGenerativeAI(API_KEY, {
    baseUrl: "[https://api.yourdomain.com](https://api.yourdomain.com)" 
});

```

### 2. OpenAI 兼容模式 (`gemini-oai.js`)

专为不支持 Google 原生格式，仅支持标准 OpenAI 格式 (`/v1/chat/completions`) 的软件设计。

* **✅ 适用场景：** 沉浸式翻译、ChatGPT-Next-Web、LobeChat。
* **⚙️ 核心逻辑：**
* **路径重写：** 自动将 `v1/chat/completions` 映射至 Google 的 `v1beta` 路径。
* **CORS 优化：** 完整处理跨域预检，支持浏览器环境直接调用。


* **💻 客户端配置：**
* **Base URL:** `https://api.yourdomain.com/v1` (⚠️ 注意末尾需加 `/v1`)
* **API Key:** 填写您的 Google AI Studio API Key。
* **Model:** 填写 Google 模型 ID（如 `gemini-2.5-pro`, `gemini-3-flash-preview`）。



---

## 🛠️ 进阶功能：GCLI 专用路由

*此部分适用于使用 [su-kaka/gcli2api](https://github.com/su-kaka/gcli2api) 项目的高级用户。*

### 3. GCLI 路由网关 (`gcli2api.js`)

作为“网络跳板”帮助本地后端穿透网络，并深度清洗 Cloudflare 特征头以降低风控风险。

* **配置方式：**
```bash
export GCLI_API_BASE="[https://gcli-gateway.yourdomain.com](https://gcli-gateway.yourdomain.com)"

```



### 4. Claude 协议适配器 (`gcli2api-claude.js`)

让仅支持 Claude 协议的客户端（如 `claude-code` 命令行工具）通过 gcli2api 调用 Google 模型。

* **特性：** 支持 `/v1/models` 拦截伪造及 SSE 流式响应转换。

---

## 🛡️ 安全与隐私声明

本项目致力于保护您的数据安全：

* **特征清洗：** 自动移除 `Cf-Connecting-Ip`、`X-Forwarded-For`、`Cf-Ray` 等可能泄露原始 IP 的 Header。
* **身份伪装：** 强制重写 `Host` 和 `Origin`，模拟合法直连请求。
* **零日志：** 脚本运行在无状态的 Serverless 环境，**不存储**任何用户数据或 API Key。

## ⚠️ 免责声明

本项目仅供技术研究和学习使用，请勿用于非法用途。使用本服务时请严格遵守 Google Cloud Platform 及 Cloudflare 的服务条款。

---

**⭐ 如果这个项目对你有帮助，欢迎点个 Star！**

```

需要我帮你把这些脚本代码也做一下简单的注释规范化吗？

```
