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
