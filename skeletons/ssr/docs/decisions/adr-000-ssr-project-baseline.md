# ADR-000 SSR Project Baseline

## 状态

待正式应用初始化时确认。

## 默认决策

| Area            | Default                                             |
| --------------- | --------------------------------------------------- |
| Framework       | Next.js 16 App Router + React 19                    |
| Backend mode    | 初始化时选择 `bff-only` 或 `next-backend`           |
| Middleware      | `src/proxy.ts`                                      |
| BFF prefix      | `/<project-id>-api`                                 |
| Locale route    | 公开页 `/zh-CN` `/en-US`；非公开页 cookie + refresh |
| Auth cookie     | `<project-snake>_auth`                              |
| Locale cookie   | `<project-snake>_locale`                            |
| Build           | Next standalone                                     |
| Deployment      | PM2 或平台等价方式                                  |
| Release refresh | production 启用，development 禁用                   |
| Package manager | pnpm                                                |

## 初始化输入

- [ ] 提供一个不带 `-web` 的小写 kebab-case 项目 ID
- [ ] 选择 `backend-mode`
- [ ] `bff-only` 绑定配套后端关系，或 `next-backend` 生成本地能力矩阵

项目展示名、package、cookie、BFF、PM2 和日志标识均按默认规则派生。只有正式应用需要偏离默认
策略时，才在本 ADR 中追加例外。

后端 URL、mock URL、端口、日志级别、SEO 描述、图片域名和密钥属于环境或发布配置，不在此处重复确认。
