# Project Naming

本文定义新应用复制骨架后的项目身份、目录关系与交付文档根。初始化器接收一个不带 `-web` 的小写
kebab-case 基础项目名，并要求明确是否有配套后端仓库（`--backend-root` 或 `--no-backend`）。

初始化参数与占位值按变体不同，见文末补段。

## Initialization Input

| Variable       | Meaning                    | Example            |
| -------------- | -------------------------- | ------------------ |
| `<project-id>` | 小写 kebab-case 基础项目名 | `supply-lifecycle` |

输入已带 `-web` 时初始化器会移除末尾后缀，再按统一规则重新派生，避免生成 `-web-web`。

## Placeholder Binding

当前骨架为了保持可运行，使用一组占位值。各变体的占位值、派生清单和 grep 命令见文末补段；复制为
正式应用后，第一步必须替换并确认。

| Variable              | Meaning                          |
| --------------------- | -------------------------------- |
| `<frontend-root>`     | 前端仓库根目录                   |
| `<backend-root>`      | 配套后端仓库根目录；没有则为 N/A |
| `<delivery-doc-root>` | 交付文档根目录                   |

没有配套、由当前项目维护的后端仓库时，初始化器将 `<backend-root>` 绑定为 `N/A`，
`<delivery-doc-root>` 绑定为当前仓库 `.`。这不影响前端自身 BFF 或已确认的外部 API。

## Initialization Checklist

- [ ] `<project-id>` 已由使用者提供
- [ ] 已通过 `--backend-root` 或 `--no-backend` 明确配套后端关系
- [ ] `<frontend-root>`、`<backend-root>`、`<delivery-doc-root>` 已绑定
- [ ] README、AGENTS 与项目绑定文档已同步
- [ ] 骨架占位值已按变体补段清理

## Hard Rules

- 规范正文不得写入具体域名、token、cookie value、后端凭证或部署账号。
- 配套仓库和文档根只记录相对路径，不得写个人机器绝对路径。
- 文档中的文件引用只能指向当前仓库内存在的文件；跨仓库内容直接复制或改为文字说明。

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
