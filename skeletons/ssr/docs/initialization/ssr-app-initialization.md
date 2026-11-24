# SSR 应用初始化清单

复制骨架后，先使用 `.agents/skills/initialize-ssr-project/SKILL.md`，输入一个不带 `-web`
的小写 kebab-case 基础项目名，并通过 `--backend-mode` 明确运行模式。`bff-only` 再通过
`--backend-root` 或 `--no-backend` 明确配套 Java 后端关系。
skill 会自动派生 package、PM2、日志、cookie、BFF 和版本刷新标识；只有后端地址、正式域名、密钥
和图片白名单仍需在接入时配置。

`bff-only` 是 Web/SSR/BFF 模式，仍允许 RSC、Route Handler、Server Action 和 HTTP gateway，
但禁止当前仓库拥有领域、数据库或中间件基础设施。`next-backend` 在相同 Web/BFF 基线上增加
受控的 Application、Domain 和 Infrastructure，不能绕过 `src/bff/**`。

## 1. 确认项目身份

- [ ] 提供 `<project-id>`
- [ ] 自动派生 `<project-name>` 为 `<project-id>-web`
- [ ] 生成 `<project-snake>`
- [ ] 检查 package、service、PM2 和 BFF 前缀派生值
- [ ] 选择 `--backend-mode bff-only` 或 `--backend-mode next-backend`
- [ ] `bff-only` 有配套 Java 后端时使用 `--backend-root <relative-path>`；没有配套仓库时使用 `--no-backend`
- [ ] `next-backend` 拒绝 `--backend-root` 与 `--no-backend`，后端实现根为当前仓库
- [ ] `docs/rules/shared/project-naming.md` 已记录 `<backend-root>` 和 `<delivery-doc-root>`
- [ ] 配套后端使用其 `.agents/skills/initialize-backend-project/SKILL.md` 初始化并反向绑定前端路径
- [ ] `.agents/ssr-project.md`、基线 ADR 与运行环境中的 `BACKEND_MODE` 三者一致

## 2. 检查默认策略

- [ ] 默认保留认证区
- [ ] 默认使用 `<project-snake>_auth` 和 `<project-snake>_locale`
- [ ] 默认关闭 CSRF；只有 double-submit 方案才使用 `<project-snake>_csrf`
- [ ] 默认使用 `/<project-id>-api`，不占用 `/api`
- [ ] 默认不使用 locale route

## 3. 替换占位内容

- [ ] 更新 README、AGENTS、`.agents/ssr-project.md`
- [ ] 更新 locale metadata、manifest、icon 和 Open Graph 文案
- [ ] 更新 `next.config.ts` 图片域名白名单
- [ ] 更新 CSP、CORS、站点 origin 和后端地址
- [ ] 更新 PM2 名称、日志目录和发布文档
- [ ] 确认部署用户可创建并写入 `/data/logs/<project-id>-web`，或配置 `PM2_LOG_DIRECTORY`
- [ ] 如覆盖 `PM2_APP_NAME`，确认日志目录、PM2 交接和监控名称同步
- [ ] 删除或替换 `ssr-app` 占位字符串
- [ ] 如使用 `next-backend`，完成 capability matrix、Node runtime、数据库/中间件配置和 PM2 发布绑定
- [ ] `bff-only` 的 capability matrix 禁用 database、applicationAuthorization 和全部本地基础设施能力
- [ ] `next-backend` 的 database 初始为 `enabled-unbound`，绑定技术选型、迁移、连接池和验证后才能改为 `enabled`

## 4. 接入真实契约

- [ ] 为每个 endpoint 建立 OpenAPI path 和 operationId
- [ ] 建立 DTO、adapter、service、gateway 和 mock example
- [ ] 明确公开、认证、权限和缓存策略
- [ ] 不把真实 token、cookie、域名或密钥写入仓库
- [ ] 如使用 `next-backend`，至少完成 BFF、鉴权、数据库、事务、幂等和 PM2 规范门禁

## 5. 首次验证

- [ ] 部署环境显式设置 `BACKEND_MODE`，不得依赖初始化 CLI 的兼容默认值
- [ ] `bff-only` 项目不存在或未启用 `src/server/**`
- [ ] `next-backend` 项目通过 BFF、Application、Domain、Infrastructure 依赖边界测试
- [ ] PM2 配置和发布交接中的模式、migration、readiness 与 `PM2_SAVE_AFTER_HEALTH` 策略一致

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm mock:check
pnpm test
pnpm build
pnpm build:dist:prod
bash -n scripts/deploy.sh
```
