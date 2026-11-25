# SSR 应用初始化清单

复制骨架后，先使用 `.agents/skills/initialize-ssr-project/SKILL.md`，输入一个不带 `-web`
的小写 kebab-case 基础项目名，并通过 `--backend-root` 或 `--no-backend` 明确配套 Java 后端关系。
skill 会自动派生 package、PM2、日志、cookie、BFF 和版本刷新标识；只有后端地址、正式域名、密钥
和图片白名单仍需在接入时配置。

SSR 骨架固定 BFF-only：仍允许 RSC、Route Handler、Server Action 和 HTTP gateway，但禁止当前仓库
拥有领域、数据库或中间件基础设施，这些能力由配套 Java 后端仓库负责。

## 1. 确认项目身份

- [ ] 提供 `<project-id>`
- [ ] 自动派生 `<project-name>` 为 `<project-id>-web`
- [ ] 生成 `<project-snake>`
- [ ] 检查 package、service、PM2 和 BFF 前缀派生值
- [ ] 有配套 Java 后端时使用 `--backend-root <relative-path>`；没有配套仓库时使用 `--no-backend`
- [ ] `docs/rules/shared/project-naming.md` 已记录 `<backend-root>` 和 `<delivery-doc-root>`
- [ ] `.agents/ssr-project.md` 与基线 ADR 中的项目身份、后端关系一致

## 2. 检查默认策略

- [ ] 默认保留认证区
- [ ] 默认使用 `<project-snake>_auth` 和 `<project-snake>_locale`
- [ ] 默认关闭 CSRF；只有 double-submit 方案才使用 `<project-snake>_csrf`
- [ ] 默认使用 `/<project-id>-api`，不占用 `/api`
- [ ] 公开区使用 `app/[locale]` 语言段，非公开区使用 cookie + refresh

## 3. 替换占位内容

- [ ] 更新 README、AGENTS、`.agents/ssr-project.md`
- [ ] 更新 locale metadata、manifest、icon 和 Open Graph 文案
- [ ] 更新 `next.config.ts` 图片域名白名单
- [ ] 更新 CSP、CORS、站点 origin 和后端地址
- [ ] 更新 PM2 名称、日志目录和发布文档
- [ ] 确认部署用户可创建并写入 `/data/logs/<project-id>-web`，或配置 `PM2_LOG_DIRECTORY`
- [ ] 如覆盖 `PM2_APP_NAME`，确认日志目录、PM2 交接和监控名称同步
- [ ] 删除或替换 `ssr-app` 占位字符串
- [ ] capability matrix 保持 database、applicationAuthorization 和全部本地基础设施能力为禁用

## 4. 接入真实契约

- [ ] 为每个 endpoint 建立 OpenAPI path 和 operationId
- [ ] 建立 DTO、adapter、service、gateway 和 mock example
- [ ] 明确公开、认证、权限和缓存策略
- [ ] 不把真实 token、cookie、域名或密钥写入仓库

## 5. 首次验证

- [ ] 项目不存在或未启用 `src/server/**`
- [ ] PM2 配置和发布交接中的 migration、readiness 与 `PM2_SAVE_AFTER_HEALTH` 策略一致

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm mock:check
pnpm test
pnpm build
pnpm build:dist:prod
bash -n scripts/deploy.sh
```
