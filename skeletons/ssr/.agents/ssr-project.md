# SSR Project Binding

本文件描述当前骨架的占位运行形态。复制为正式应用后，先同步更新
`docs/rules/shared/project-naming.md`，再更新本文件。

| Item                  | Placeholder                |
| --------------------- | -------------------------- |
| Project name          | `SSR Application Skeleton` |
| Project ID            | `ssr-app`                  |
| Package name          | `ssr-app-web`              |
| Auth cookie           | `ssr_app_auth`             |
| Locale cookie         | `ssr_app_locale`           |
| Next BFF prefix       | `/ssr-app-api`             |
| PM2 app name          | `ssr-app-web`              |
| Log directory         | `/data/logs/ssr-app-web`   |
| OpenAPI / Prism entry | `mock/openapi.yaml`        |
| Paired backend        | `N/A`（`--no-backend`）    |

SSR 骨架固定 BFF-only：Next.js 只承担 Web、SSR 和 BFF，不承担本地领域或数据基础设施。初始化时只
需要确认配套 Java 后端关系，即 `--backend-root` 或 `--no-backend`。

这些值仅用于让骨架可以运行。正式应用不得直接沿用占位身份。
