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

## Placeholder Values

当前 SSR 骨架使用以下占位值，初始化时必须替换：

| Variable                  | Placeholder                |
| ------------------------- | -------------------------- |
| `<project-name>`          | `SSR Application Skeleton` |
| `<project-id>`            | `ssr-app`                  |
| `<project-snake>`         | `ssr_app`                  |
| `<frontend-package-name>` | `ssr-app-web`              |
| `<frontend-bff-prefix>`   | `ssr-app-api`              |

复制为正式应用后执行：

```bash
rg -n "ssr-app|SSR Application Skeleton" .
```

命中项必须全部替换或确认属于说明性文字。

## Initialization Mode

本骨架固定为 BFF-only：Next.js 承担 Web、SSR 和 BFF，不承担领域、数据库或中间件基础设施，
不提供 `next-backend` 模式。初始化器只要求明确配套 Java 后端关系：

- 配套后端：`--backend-root <relative-path>`
- 无配套后端：`--no-backend`

`<backend-root>` 是交付文档根；没有配套后端时绑定为 `N/A`，`<delivery-doc-root>` 绑定为当前仓库
`.`。配套后端必须使用其仓库自带的初始化技能完成绑定，不得从当前前端仓库引用后端文件。

## Initialization Checklist

- [ ] `<project-id>` 已由使用者提供
- [ ] `<project-name>` 已派生为 `<project-id>-web`
- [ ] 已通过 `--backend-root` 或 `--no-backend` 明确配套 Java 后端关系
- [ ] `<project-snake>` 已由 ID 派生
- [ ] package、service、PM2 名称已同步
- [ ] auth / locale cookie 名已确认
- [ ] BFF 前缀已确认未与 `/api` 或现有网关规则冲突
- [ ] README、AGENTS、`.agents/ssr-project.md` 已同步
- [ ] `rg -n "ssr-app|SSR Application Skeleton" .` 不再命中正式应用文件
- [ ] 项目内不存在 `src/server/**` 或本地 Application/Domain/Infrastructure 实现
