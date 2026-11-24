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
| Backend mode          | `bff-only`                 |

骨架将 `bff-only` 作为未传 `--backend-mode` 时的旧 CLI 兼容默认值；模式本身表示 Next.js
只承担 Web、SSR 和 BFF，不承担本地领域或数据基础设施。正式应用必须在初始化时明确确认
`bff-only` 或 `next-backend`，运行时也必须显式设置 `BACKEND_MODE`。

这些值仅用于让骨架可以运行。正式应用不得直接沿用占位身份。
