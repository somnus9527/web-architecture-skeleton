# Project Naming

本文定义新应用复制骨架后的项目身份、后端模式和仓库关系。初始化器接收一个不带 `-web` 的小写
kebab-case 基础项目名，并要求明确 `backend-mode`：

- `bff-only` + 配套后端：`--backend-root <relative-path>`
- `bff-only` + 无配套后端：`--no-backend`
- `next-backend`：当前 Next 应用承载受控后端实现

`bff-only` 是 Web/SSR/BFF 模式，不表示没有 Next.js 服务端代码；它只表示当前仓库不拥有
Application、Domain、数据库和中间件等后端实现。`next-backend` 在相同 Web/BFF 基线上增加本地
后端实现和数据权威。

## Initialization Input

| Variable         | Meaning                      | Example            |
| ---------------- | ---------------------------- | ------------------ |
| `<project-id>`   | 小写 kebab-case 基础项目名   | `supply-lifecycle` |
| `<backend-mode>` | `bff-only` 或 `next-backend` | `bff-only`         |

输入已带 `-web` 时初始化器会移除末尾后缀，再按统一规则重新派生，避免生成 `-web-web`。

## Placeholder Binding

当前骨架为了保持可运行，暂时使用以下占位值：

| Variable                        | Placeholder                            |
| ------------------------------- | -------------------------------------- |
| `<project-name>`                | `SSR Application Skeleton`             |
| `<project-id>`                  | `ssr-app`                              |
| `<project-snake>`               | `ssr_app`                              |
| `<frontend-package-name>`       | `ssr-app-web`                          |
| `<frontend-bff-prefix>`         | `ssr-app-api`                          |
| `<frontend-root>`               | `.`                                    |
| `<backend-root>`                | `../backend-architecture-skeleton`     |
| `<delivery-doc-root>`           | `<backend-root>`                       |
| `<backend-implementation-root>` | `.`（next-backend）或 `<backend-root>` |

复制为正式应用后，第一步必须替换并确认本表。

没有配套、由当前项目维护的 Java 后端仓库时，初始化器将 `<backend-root>` 绑定为 `N/A`，
`<delivery-doc-root>` 绑定为当前仓库 `.`。这不影响 SSR 自身 BFF 或已确认的外部 API。
`next-backend` 将 `<backend-root>` 绑定为 `N/A`、`<backend-implementation-root>` 绑定为当前仓库
`.`，并在项目绑定和 ADR 中记录本地后端能力。

## Derived Values

| Target        | Rule                                              |
| ------------- | ------------------------------------------------- |
| Project name  | `<project-id>-web`                                |
| Package name  | `<project-id>-web`                                |
| Service name  | `<project-id>-web`                                |
| PM2 app name  | `<project-id>-web`                                |
| Auth cookie   | `<project-snake>_auth`                            |
| Locale cookie | `<project-snake>_locale`                          |
| CSRF cookie   | `<project-snake>_csrf`，仅 double-submit 方案需要 |
| BFF URL       | `/<frontend-bff-prefix>`                          |
| Log directory | `/data/logs/<project-id>-web`                     |
| SEO site name | `<project-name>`                                  |

默认派生值不需要逐项确认。业务展示名需要区别于 `<project-id>-web`，或登录体系、网关、部署平台
不接受默认值时，再在 ADR 中记录例外。

PM2 应用名默认由 `PROJECT_ID` 派生，可用 `PM2_APP_NAME` 覆盖。日志目录默认跟随最终 PM2 应用名，
可用 `PM2_LOG_DIRECTORY` 覆盖。覆盖任一值时必须同步部署交接记录。

## Initialization Checklist

- [ ] `<project-id>` 已由使用者提供
- [ ] `<project-name>` 已派生为 `<project-id>-web`
- [ ] 已通过 `--backend-root` 或 `--no-backend` 明确配套 Java 后端关系
- [ ] `<backend-mode>` 已明确；`next-backend` 已记录 capability matrix
- [ ] `<project-snake>` 已由 ID 派生
- [ ] package、service、PM2 名称已同步
- [ ] auth / locale cookie 名已确认
- [ ] BFF 前缀已确认未与 `/api` 或现有网关规则冲突
- [ ] README、AGENTS、`.agents/ssr-project.md` 已同步
- [ ] `rg -n "ssr-app|SSR Application Skeleton" .` 不再命中正式应用文件

## Hard Rules

- 默认应用展示名为 `<project-id>-web`；业务需要品牌展示名时单独覆盖 metadata 和 locale。
- URL、cookie、service、PM2 和日志名称只能使用派生的机器可读 ID。
- 真实项目名只允许出现在项目绑定、README、ADR 和业务文档中。
- 规范正文不得写入具体域名、token、cookie value、后端凭证或部署账号。
- 配套仓库和文档根只记录相对路径，不得写个人机器绝对路径。
