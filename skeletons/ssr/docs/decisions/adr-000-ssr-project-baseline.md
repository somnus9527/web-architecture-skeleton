# ADR-000 SSR Project Baseline

## 状态

待正式应用初始化时确认。

## 默认决策

| Area            | Default                                          |
| --------------- | ------------------------------------------------ |
| Framework       | Next.js 16 App Router + React 19                 |
| Middleware      | `src/proxy.ts`                                   |
| BFF prefix      | `/<project-id>-api`                              |
| Locale route    | 公开区 `app/[locale]`；非公开区 cookie + refresh |
| Auth cookie     | `<project-snake>_auth`                           |
| Locale cookie   | `<project-snake>_locale`                         |
| Build           | Next standalone                                  |
| Deployment      | PM2 或平台等价方式                               |
| Release refresh | production 启用，development 禁用                |
| Package manager | pnpm                                             |

## 初始化输入

- [ ] 提供一个不带 `-web` 的小写 kebab-case 项目 ID
- [ ] 确认配套 Java 后端关系：`--backend-root <relative-path>` 或 `--no-backend`

项目展示名、package、cookie、BFF、PM2 和日志标识均按默认规则派生。只有正式应用需要偏离默认
策略时，才在本 ADR 中追加例外。

## 后端边界

SSR 骨架固定 BFF-only：Next.js 只承担 Web、SSR 和 BFF，不承担数据库、Redis、MQ、worker 或
完整领域能力，这些能力由配套 Java 后端仓库负责。

后端 URL、mock URL、端口、日志级别、SEO 描述、图片域名和密钥属于环境或发布配置，不在此处重复确认。
