# SSR

- 生成目录：`<target>`，包名默认 `<name>-web`。
- 初始化参数：`--no-backend`；BFF 与后端绑定单独处理。
- 注意 CSP、HttpOnly cookie、requestId/traceparent 串联规则随规则文档一起生成。
- 生成的 `.agents/architecture-source.json` 记录仓库、tag、commit。
- 检查入口：`pnpm quality:check`。
