# SPA

- 生成目录：`<target>`，包名默认 `<name>-web`（可由 `--package-name` 覆盖）。
- 初始化参数：`--no-backend`；后端绑定不在本技能内。
- 路由 history 模式，`VITE_APP_BASE_PATH`、Router basename、Nginx location 三处一致。
- 生成的 `.agents/architecture-source.json` 记录仓库、tag、commit。
- 检查入口：`pnpm quality:check`（包含架构测试、安全、复用、UI 边界与构建）。
