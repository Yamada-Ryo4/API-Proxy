# 🌐 AI-Proxy (Cloudflare Workers 版)

[![Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI-412991?logo=openai&logoColor=white)](https://openai.com/)
[![Anthropic](https://img.shields.io/badge/AI-Claude-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

本项目提供了一套**零成本、高性能**的 AI API 代理与协议转换解决方案。利用 Cloudflare 全球边缘节点，实现对 OpenAI、Claude、Gemini 等主流模型接口的**无障碍访问**、**协议转换**及**隐私清洗**。

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

| 脚本文件 | 类型 | 核心功能 | 适用场景 / 客户端 |
| :--- | :--- | :--- | :--- |
| `openai.js` | 🛡️ **直连代理** | **OpenAI 全功能代理** (含 WebSocket) | 官方 SDK, Realtime API, Cursor |
| `claude.js` | 🛡️ **直连代理** | **Claude 官方代理** (含 CORS 修复) | Anthropic SDK, Claude Web |
| `gemini-official.js` | 🛡️ **直连代理** | **Gemini 官方代理** | Google SDK, Multimodal Live API |
| `gemini-oai.js` | 🔄 **协议转换** | **Gemini 转 OpenAI 协议** | NextChat, LobeChat, 沉浸式翻译 |
| `gemini-claude.js` | 🔄 **协议转换** | **Gemini 转 Claude 协议** | 仅支持 Claude 协议的工具 (如 Cursor 特定模式) |
| `gcli2api.js` | 🌉 **GCLI 网关** | **GCLI 路由网关** | 配合 `su-kaka/gcli2api` 后端 |

---

## 🚀 核心功能详解

### 1. 🌐 通用官方直连代理 (Universal Proxies)

这一类脚本提供**纯粹的透传服务**。它们不修改数据格式，仅处理网络连通性、跨域头 (CORS) 和隐私头清洗。

#### A. OpenAI Proxy (`openai.js`)
支持所有 OpenAI 接口，包括最新的 **Realtime API (WebSocket)**。
* **特性：** 完美支持流式输出 (SSE) 和语音实时对话。
* **客户端配置：**
  * Base URL: `https://your-domain.com/v1`
  * API Key: `sk-proj-...` (OpenAI 官方 Key)

#### B. Claude Proxy (`claude.js`)
专为 Anthropic Claude 设计，修复了浏览器端调用的 CORS 问题。
* **特性：** 自动处理 `x-api-key` 和 `anthropic-version` 头。
* **客户端配置：**
  * Base URL: `https://your-domain.com` (部分客户端需加 `/v1`)
  * API Key: `sk-ant-...` (Anthropic 官方 Key)

#### C. Gemini Official Proxy (`gemini-official.js`)
Google Gemini 的透明管道。
* **特性：** 支持 Python/Node.js 官方 SDK 及 Multimodal Live API。

---

### 2. 🔄 协议转换适配器 (Protocol Adapters)

这一类脚本让**一种模型伪装成另一种模型**，解决客户端兼容性问题。

#### A. Gemini 转 OpenAI (`gemini-oai.js`)
让 Gemini 兼容所有支持 OpenAI 的软件。
* **原理：** 将 `/v1/chat/completions` 映射到 Google 的 `/v1beta/openai/` 兼容端点。
* **配置：**
  * **Base URL:** `https://your-domain.com/v1`
  * **API Key:** 填写 **Google Gemini API Key**。
  * **Model:** 填写 Gemini 模型名 (如 `gemini-2.5-flash`)。

#### B. Gemini 转 Claude (`gemini-claude.js`)
让 Gemini 伪装成 Claude，供仅支持 Claude 协议的工具使用。
* **原理：** 深度转换 JSON 结构 (`messages` ↔ `contents`)，支持 System Prompt 提取。
* **⚠️ 注意：**
  1. **API Key:** 在客户端的 Claude Key 输入框中，填写 **Google Gemini Key**。
  2. **Model:** 必须手动输入 Gemini 模型名 (如 `gemini-2.5-pro`)，不可选择 `claude-sonnet-4.5`。
  3. **流式：** 建议优先使用**非流式模式**以获得最佳稳定性。

---

## 🛠️ 进阶功能：GCLI 专用路由

*此部分适用于使用 [su-kaka/gcli2api](https://github.com/su-kaka/gcli2api) 项目的高级用户。*

### GCLI 路由网关 (`gcli2api.js` & `gcli2api-claude.js`)
作为“网络跳板”帮助本地后端穿透网络，并深度清洗 Cloudflare 特征头以降低风控风险。支持普通 HTTP 路由及 Claude 协议的特殊适配。

---

## 🛡️ 安全与隐私声明

本项目致力于保护您的数据安全：

* **特征清洗：** 自动移除 `Cf-Connecting-Ip`、`X-Forwarded-For`、`Cf-Ray` 等可能泄露原始 IP 的 Header。
* **身份伪装：** 强制重写 `Host` 和 `Origin`，通过官方 API 的安全校验。
* **零日志：** 脚本运行在无状态的 Serverless 环境，**不存储**任何用户数据或 API Key。

## ⚠️ 免责声明

本项目仅供技术研究和学习使用，请勿用于非法用途。使用本服务时请严格遵守 OpenAI、Anthropic、Google 及 Cloudflare 的服务条款。

---

**⭐ 如果这个项目对你有帮助，欢迎点个 Star！**
