# Rules

本目录是配套前后端模板的通用规则入口。规则描述工程边界、协作方式和技术约束，不包含任何固定业务
项目的模块、接口、表、状态、权限码或集成事实。正式应用的名称、ID、cookie、BFF 前缀和仓库关系
统一在 [`shared/project-naming.md`](./shared/project-naming.md) 绑定。

## 目录结构

| Directory                          | Scope                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| [`shared/`](./shared/)             | 前后端共享的命名、注释、协作、文档和交付规则                |
| [`frontend/`](./frontend/)         | React、Next.js、SSR、BFF、SEO、安全和交付                   |
| [`next-backend/`](./next-backend/) | Next.js 受控后端、数据库、中间件和 PM2 规则                 |
| [`backend/`](./backend/)           | Java 后端架构、分层、数据、中间件、安全、事务和代码质量规则 |

## SSR/BFF 分流

| Concern        | SSR/BFF                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| Routing        | `frontend/ssr-routing-and-rsc.md`                                       |
| API calls      | `frontend/ssr-bff-boundaries.md` + `frontend/ssr-contracts-and-mock.md` |
| Auth           | cookie + BFF header conversion                                          |
| i18n           | `frontend/ssr-i18n.md`，默认不使用 locale route                         |
| Cache          | `frontend/ssr-cache-and-performance.md`                                 |
| Runtime config | `frontend/ssr-runtime-config.md`                                        |
| Logging        | `frontend/ssr-observability-and-logging.md`                             |
| Delivery       | `frontend/ssr-delivery-workflow.md` + `docs/deployment/`                |

## Backend Mode Scope

`bff-only` 是 **Web/SSR/BFF 模式**，不是浏览器静态前端模式。Next.js 仍负责 RSC、Route Handler、
Server Action、cookie/session facade 和 BFF HTTP gateway，但不承担领域实现、数据权威或基础设施。

`next-backend` 是 **Web + 本地后端模式**。它在相同 Web/BFF 基线上增加
`src/server/application|domain|infrastructure|config|composition`，并允许当前 Next.js Node.js
进程承载受控同步后端能力。

| Rule scope           | `bff-only`                  | `next-backend`                    | Java backend project |
| -------------------- | --------------------------- | --------------------------------- | -------------------- |
| `shared/**`          | 必须                        | 必须                              | 必须                 |
| `frontend/**`        | 必须                        | 必须                              | 不适用               |
| `next-backend/**`    | 不生效                      | 必须                              | 不适用               |
| `backend/**`         | 仅配套 Java 后端仓库使用    | 不生效                            | 必须                 |
| `docs/deployment/**` | SSR/PM2 通用发布基线        | 通用基线 + Next 后端 PM2 增量规则 | 使用后端仓库发布规则 |
| `src/server/**`      | 禁止创建或启用              | 按 capability binding 条件启用    | 不适用               |
| DB/Redis/MQ/worker   | 禁止在当前 Next.js 仓库实现 | 仅启用对应 capability 后允许      | 由 Java 后端规则约束 |

`frontend/**` 表示 Next.js 的 Web、SSR 和 BFF 表面规则，不表示整个项目只能承担前端职责，因此
两个模式都必须执行。`next-backend/**` 是 `next-backend` 模式的增量规则，不替代
`frontend/**`；`backend/**` 只约束独立 Java 后端项目，不约束 Next.js 本地后端实现。

规则文件可能因骨架同步同时存在于仓库，但“文件存在”不代表“当前项目已启用”。项目实际模式以
`.agents/ssr-project.md` 和基线 ADR 为事实源。模式切换必须重新评审数据权威、依赖、migration 和
部署方案，不能只修改 `BACKEND_MODE`。

## 使用规则

1. 新应用复制后，使用 `$initialize-ssr-project --backend-mode bff-only --no-backend <project-id>`，
   或通过 `--backend-mode bff-only --backend-root ../<backend-project>` 绑定配套 Java 后端；
   需要 Next 承担受控后端实现时使用 `$initialize-ssr-project --backend-mode next-backend <project-id>`。
2. Java 后端开发先读 [`backend/README.md`](./backend/README.md)，再进入目标后端仓库读取其
   `AGENTS.md` 和本地门禁说明。
3. 只在默认基线不适用时新增 ADR。
4. 规范更新时保持变量化，不把正式应用名写回通用规则。
5. 业务 API、实现事实、法律内容和运行环境参数不放入本目录。

## 模板协作边界

- 从本仓库根目录到默认后端模板的相对路径是
  [`../backend-architecture-skeleton`](../../../backend-architecture-skeleton)。
- `shared/**`、`frontend/**` 和 `backend/**` 是通用规则源；后端模板不得从业务服务复制另一套规则。
- 后端模板的 Maven、ArchUnit、ErrorProne、Spotless、Git Hook、Codex/Claude Hook 和 CI 脚本是
  可执行门禁，不由本目录的 Markdown 替代。
- 没有配套 Java 后端的 SSR 项目不创建空后端仓库；SSR 自身 BFF 和外部 API 继续遵守本分支规则。
- `next-backend` 项目的 Web 业务仍必须经过 `src/bff/**`；数据库、事务和基础设施只能位于
  `src/server/**`，细则见 [`next-backend/`](./next-backend/)。
- 纯后端项目读取本仓库的 shared/backend 规则不构成 Next.js 代码、Node.js 运行时或部署依赖。
- 两个模板不在同一父目录时，派生项目必须记录新的相对路径并同步入口文档；不要写个人绝对路径。
- 修改共享规则或后端通用规则时，应在同一变更窗口检查两个模板的入口、链接和门禁是否仍一致。
