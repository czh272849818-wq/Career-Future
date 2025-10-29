# 职向未来 Pro

一个基于 React + Vite 的职业发展辅助应用，包含测评、简历优化、AI面试、AI职业规划师等模块。

## 技术栈
- 前端：React + Vite + TailwindCSS
- 后端：Node/Express（代理 DeepSeek API、简历文本提取）
- 构建与部署：Netlify（前端），Render/Railway/Fly（后端）

## 本地开发
```
# 安装依赖
npm install

# 前端开发（含本地代理）
npm run dev:host

# 启动后端（DeepSeek代理与简历文本提取）
npm run server

# 生产预览（构建后预览）
npm run build && npm run preview:host
```

## 环境变量
- 前端：
  - `VITE_API_BASE`（可选）：设置后端服务基础地址，例如 `https://your-backend.example.com`。
    - 未设置时，前端默认使用相对路径 `/api/...`。
- 后端（必须在服务器环境中设置，不要放入前端）：
  - `DEEPSEEK_API_KEY`：你的 DeepSeek API 密钥。
  - `PORT`（可选）：默认 `3001`。

## 重要文件
- `src/api.ts`：统一接口前缀
  - 当 `VITE_API_BASE` 存在：请求走 `https://your-backend.example.com/api/...`
  - 当 `VITE_API_BASE` 不存在：请求走相对路径 `/api/...`
- `public/_redirects`：`/* /index.html 200`，用于 Netlify SPA 路由。
- `vite.config.ts`：开发代理将 `/api` 代理到 `http://localhost:3001`。
- `server/index.js`：后端服务（Express），提供：
  - `POST /api/extract-text`：简历文本提取（支持 txt/docx/doc/pdf、图片OCR）
  - `POST /api/deepseek/chat`：代理 DeepSeek 聊天（支持流式输出）
  - `GET  /api/health`：健康检查

## 部署方案
### 前端（Netlify，Git连接）
1. 在 Netlify 创建站点，选择 “New site from Git”，连接你的仓库。
2. 构建设置：
   - `Build command`: `npm run build`
   - `Publish directory`: `dist`
3. 环境变量：
   - 设置 `VITE_API_BASE=https://你的后端域名`
4. `public/_redirects` 会在构建时自动打包到 `dist`，保证路由正常。

### 后端（Render/Railway/Fly 等）
1. 部署 `server/index.js` 到 Node 运行环境。
2. 设置环境变量 `DEEPSEEK_API_KEY`（必须）、`PORT`（可选）。
3. 放行跨域（已在代码中使用 `cors()`）。
4. 获取公网域名，例如 `https://your-backend.example.com`，供前端使用。

### 注意事项
- 不要在前端暴露或打包后端密钥（如 `DEEPSEEK_API_KEY`）。
- 浏览器报 `Failed to fetch` 或 `net::ERR_ABORTED` 多为后端未启动或密钥缺失。
- 若后端依赖较重（如 `tesseract.js`），建议使用专用 Node 服务，而非函数环境。

### CI 自动部署（GitHub Actions + Netlify）
仓库已内置工作流：`.github/workflows/netlify-deploy.yml`，在推送到 `main` 时自动构建并部署到 Netlify。

1) 在 GitHub 仓库 Settings → Secrets and variables → Actions 添加：
- `NETLIFY_AUTH_TOKEN`：Netlify 个人访问令牌
- `NETLIFY_SITE_ID`：Netlify 站点 ID（在 Netlify 站点设置中可见）
- `DEEPSEEK_API_KEY`：DeepSeek 密钥（可选，用于通过 CLI 写入站点环境变量）

2) 触发部署：
- 推送到 `main` 或在 Actions 中手动运行工作流（`workflow_dispatch`）。
- 工作流会使用 `netlify deploy --build --prod` 完成构建与生产部署。

3) 验证 Edge Functions 与接口：
- 行业列表：`GET /api/deepseek/taxonomy?kind=industries`
- 岗位列表：`GET /api/deepseek/taxonomy?kind=positions&industry=互联网`

提示：也可在 Netlify 控制台中绑定 GitHub 仓库进行持续部署；请确保在 Netlify 站点的 Environment variables 中配置 `DEEPSEEK_API_KEY`，以便 Edge Function 读取。

## AI 职业规划师（流式输出）
- `src/llm/config.ts` 设定 `DEFAULT_STREAM = true`，默认启用流式。
- `src/contexts/ChatContext.tsx` 实现 SSE 解析与占位消息逐字更新，首个分片到达时关闭输入指示点，提升体验。

## 许可
本项目不包含明确的开源许可条款；如需开源或授权，请补充许可文件。
