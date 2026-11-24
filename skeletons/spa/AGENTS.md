# Project AGENTS

## Always-on

- 本仓库是可复制的 React SPA 项目骨架，不是正式业务应用。
- 本仓库同时承载前后端共享规则和通用 Java 后端规则；默认配套后端模板相对路径为
  `../backend-architecture-skeleton`。
- 纯后端项目读取本仓库的 shared/backend 规则，不代表需要引入本仓库的 React 代码、Node.js 运行时
  或前端部署产物。
- 新应用复制后，必须先完成项目变量绑定和 SPA 初始化清单。
- 不得套用 Next.js、RSC、Server Action 或 BFF 规则。
- 路由使用 history 模式，`VITE_APP_BASE_PATH`、Router basename 和 Nginx location 必须一致。
- HTTP 调用统一经过 feature service 和 `src/shared/tools/api-client.ts`。
- interface 使用 `I` 前缀；type alias 使用语义化 PascalCase；状态联合类型使用业务名。
- 所有用户可见文案进入 `src/locale/**`；错误处理必须记录稳定事件名。
- 构建、发布和验证统一使用 pnpm，不得引入 `package-lock.json`。
- `spa-app`、`spa-app-web` 和 `SPA Application` 都是待替换占位值。

## Routing

- 用户要求初始化复制后的 SPA 骨架并提供一个 kebab-case 项目名时，使用
  `.agents/skills/initialize-spa-project/SKILL.md`，并确认 `--backend-root` 或 `--no-backend`，不要手工
  进行全仓库替换。
- 用户要求初始化 Java 后端骨架时，进入已复制的 `backend-architecture-skeleton` 仓库并使用
  `.agents/skills/initialize-backend-project/SKILL.md`；纯前端项目不创建占位后端仓库。
- 用户要求检查或同步上游架构规范时，使用
  `.agents/skills/sync-architecture-rules/SKILL.md`，不得直接合并骨架分支。
- 修改应用结构、路由、Provider 或 feature 分层前，读取 `.agents/spa-project.md`。
- 修改环境变量、base path、构建或 Nginx 前，读取 `docs/deployment/online-release.md`。
- 修改 release ID、`version.json` 或自动刷新前，读取 `docs/rules/frontend/frontend-release-refresh.md`。
- 修改 OpenAPI、Prism、API client 或 feature service 前，读取 `docs/rules/frontend/api-contracts.md`。
- 修改前后端协作文档、模块契约或交付流程前，读取 `docs/rules/shared/intake-and-delivery.md`、
  `docs/rules/shared/module-documentation.md` 和 `docs/rules/shared/team-collaboration.md`。
- 生成或审查 Java 后端实现前，读取 `docs/rules/backend/README.md`，并进入已绑定的后端仓库读取其
  `AGENTS.md`、模板复用清单和本地质量门禁说明。
- 新增测试、架构边界或 CI 前，读取 `.agents/verification.md`。

## Rule references

- 项目差异：`.agents/spa-project.md`
- 规范来源：`.agents/architecture-source.json`
- 验证入口：`.agents/verification.md`
- SPA 基线：`docs/rules/frontend/spa-project-baseline.md`
- 初始化清单：`docs/initialization/spa-app-initialization.md`
- 发布说明：`docs/deployment/online-release.md`
- SPA 验证：`docs/rules/frontend/spa-verification.md`
- 共享规则：`docs/rules/shared/`
- Java 后端规则：`docs/rules/backend/`
- 配套后端模板：`../backend-architecture-skeleton`
