## Mock And Integration（SPA 变体）

- **Vite SPA 默认取值**：`.env.mock` 设 `VITE_API_MODE=mock`、`VITE_API_BASE_URL=/mock-api`、
  `MOCK_API_TARGET=http://127.0.0.1:4010`；`.env.dev` 设 `VITE_API_MODE=dev` 并把 `VITE_API_BASE_URL`
  指向真实浏览器请求入口。对应命令 `pnpm dev:mock` / `pnpm dev:dev`。
