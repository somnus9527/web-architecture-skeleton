## Frontend React（SPA 变体）

- 新 SPA 项目使用 Vite + React + TypeScript + Ant Design 6 + 原生 CSS/CSS 变量 + pnpm，除非目标仓库已有其他技术栈。
- 从当前骨架创建项目时使用已安装的 `initialize-project` 技能（type=spa），不要手工做全仓库替换。
- 初始化后把示例业务语言替换为真实业务，并确认基线：Ant Design `ConfigProvider` + `App`、Prism/OpenAPI mock、
  `src/shared/tools/api-client.ts`、环境文件、feature/shared 分层、zustand store、DTO、locale 文件和
  质量门禁。

- 构建产物按「运行时 / 业务入口 / 路由页面」分层：React、React Router 走 `manualChunks` 切成 `vendor-react`，
  业务页面用路由级 `lazy` 加载。不要把 antd 按包名归入一个大 chunk——那会把只在某个页面用到的组件从
  lazy chunk 提到首屏。入口 chunk 超过 500 kB 时先查依赖图，不要直接调高 `chunkSizeWarningLimit`。
