## Mock And Integration（SPA 变体）

- **Vite SPA 默认取值**：`.env.mock` 设 `VITE_API_BASE_URL=/mock-api` 与
  `MOCK_API_TARGET=http://127.0.0.1:4010`；`.env.dev` / `.env.test` 把 `VITE_API_BASE_URL` 指向各自后端
  入口；`.env.prod` 使用 Nginx 同源代理路径（如 `/api`）。对应命令 `pnpm dev:mock` / `pnpm dev:dev`。
