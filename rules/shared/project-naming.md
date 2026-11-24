# Project Naming

本文定义新应用复制骨架后的项目身份、目录关系与交付文档根。初始化器接收一个不带 `-web` 的小写
kebab-case 基础项目名，并要求明确是否有配套后端仓库（`--backend-root` 或 `--no-backend`）。

变体专属的初始化参数（例如 SSR 的 `backend-mode`）见文末补段。

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
| `<backend-root>`                | `N/A`（无配套后端时）                  |
| `<delivery-doc-root>`           | `<backend-root>`                       |
| `<backend-implementation-root>` | `.`（next-backend）或 `<backend-root>` |

复制为正式应用后，第一步必须替换并确认本表。

没有配套、由当前项目维护的 Java 后端仓库时，初始化器将 `<backend-root>` 绑定为 `N/A`，
`<delivery-doc-root>` 绑定为当前仓库 `.`。这不影响 SSR 自身 BFF 或已确认的外部 API。
`next-backend` 将 `<backend-root>` 绑定为 `N/A`、`<backend-implementation-root>` 绑定为当前仓库
`.`，并在项目绑定和 ADR 中记录本地后端能力。

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
