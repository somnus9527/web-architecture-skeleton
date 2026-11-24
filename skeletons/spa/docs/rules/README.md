# Rules

本目录是配套前后端模板的通用规则入口。规则描述工程边界、协作方式和技术约束，不包含任何固定业务
项目的模块、接口、表、状态、权限码或集成事实。

## 目录

| 目录                       | 内容                                                        |
| -------------------------- | ----------------------------------------------------------- |
| [`shared/`](./shared/)     | 前后端共享的命名、注释、协作、文档和交付规则                |
| [`frontend/`](./frontend/) | React SPA、架构、API、i18n、状态、样式、环境、发布和验证    |
| [`backend/`](./backend/)   | Java 后端架构、分层、数据、中间件、安全、事务和代码质量规则 |

## 使用方式

- 纯前端项目初始化：使用 `$initialize-spa-project --no-backend <project-id>`
- 配套前端初始化：使用
  `$initialize-spa-project --backend-root ../<backend-project> <project-id>`
- 后端项目初始化：进入已复制的后端模板，使用其 `$initialize-backend-project`；纯后端选择
  `--no-frontend`，配套项目选择 `--frontend-root`，并根据真实合约需要选择 `--with-client` 或
  `--without-client`
- 初始化前先读 [`shared/project-naming.md`](./shared/project-naming.md) 与
  [`frontend/spa-project-baseline.md`](./frontend/spa-project-baseline.md)
- Java 后端开发：先读 [`backend/README.md`](./backend/README.md)，再进入目标后端仓库读取其 `AGENTS.md`
  和本地门禁说明
- 日常开发：按根目录 `AGENTS.md` 路由读取相关规则
- 构建发布：读 [`frontend/environments-and-build.md`](./frontend/environments-and-build.md) 与
  [`../deployment/online-release.md`](../deployment/online-release.md)
- 交付验证：读 [`frontend/spa-verification.md`](./frontend/spa-verification.md)

## 模板协作边界

- 从本仓库根目录到默认后端模板的相对路径是
  [`../backend-architecture-skeleton`](../../../backend-architecture-skeleton)。
- `shared/**`、`frontend/**` 和 `backend/**` 是通用规则源；后端模板不得从业务服务复制另一套规则。
- 后端模板的 `docs/rules/README.md` 只记录本规则仓的相对路径和所有权，不再维护
  `docs/rules/backend/**` 或 `docs/rules/shared/**` 的跳转副本。
- 后端模板自身的 Maven、ArchUnit、ErrorProne、Spotless、Git Hook、Codex/Claude Hook 和 CI 脚本是
  可执行门禁，不由本目录的 Markdown 替代。
- 纯后端项目读取本仓库的 shared/backend 规则不构成前端代码、Node.js 运行时或部署依赖。
- 两个模板不在同一父目录时，派生项目必须记录新的相对路径并同步入口文档；不要写个人绝对路径。
- 修改共享规则或后端通用规则时，应在同一变更窗口检查两个模板的入口、链接和门禁是否仍一致。

本前端骨架代码不包含 Java 实现，也不适用 Next.js、RSC、Server Action 或 BFF 规则。
