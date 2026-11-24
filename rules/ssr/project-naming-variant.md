## Project Naming（SSR 变体）

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

## 初始化模式（SSR 专属）

初始化器要求明确 `backend-mode`：

- `bff-only` + 配套后端：`--backend-root <relative-path>`
- `bff-only` + 无配套后端：`--no-backend`
- `next-backend`：当前 Next 应用承载受控后端实现

`bff-only` 是 Web/SSR/BFF 模式，不表示没有 Next.js 服务端代码；它只表示当前仓库不拥有
Application、Domain、数据库和中间件等后端实现。`next-backend` 在相同 Web/BFF 基线上增加本地
后端实现和数据权威。
