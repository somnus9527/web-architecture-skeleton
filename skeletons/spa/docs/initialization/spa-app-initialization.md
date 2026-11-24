# SPA 应用初始化清单

复制骨架后，先使用 `.agents/skills/initialize-spa-project/SKILL.md`，输入一个不带 `-web`
的小写 kebab-case 基础项目名，并通过 `--backend-root` 或 `--no-backend` 明确后端关系。

## 1. 绑定项目身份

- [ ] 提供 `<project-id>`
- [ ] 自动派生应用名和 package 为 `<project-id>-web`
- [ ] 自动派生 base path 为 `/<project-id>/`
- [ ] 同步 README、AGENTS、locale、HTML title 和版本刷新标识
- [ ] 有后端时使用 `--backend-root <relative-path>`；纯前端时使用 `--no-backend`
- [ ] `docs/rules/shared/project-naming.md` 已记录 `<backend-root>` 和 `<delivery-doc-root>`；纯前端的
      `<backend-root>` 为 `N/A`，交付文档根为当前仓库 `.`

## 2. 确认部署边界

- [ ] 同步 `VITE_APP_BASE_PATH`、Nginx location 与 React Router basename
- [ ] 确认发布平台将完整 `dist/` 部署到 Nginx 静态目录
- [ ] 确认发布用户有权限 reload Nginx
- [ ] 确认 API proxy path 与后端 upstream

## 3. 接入真实契约

- [ ] 明确 `VITE_API_BASE_URL`
- [ ] 将上游 OpenAPI materialize 到 `mocks/openapi.yaml`
- [ ] 每个 endpoint 建立 operationId、DTO、feature service 和 mock example
- [ ] 删除工作台示例接口和示例业务模型

## 4. 收敛应用能力

- [ ] 决定是否保留 MUI、Tailwind、Zustand 和双语 i18n
- [ ] 替换主题、图标和展示文案
- [ ] 接入真实 logger / error reporter
- [ ] 确认认证、权限和 session 失效处理

## 5. 首次验证

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm mock:check
pnpm test
pnpm build:prod
bash -n scripts/deploy.sh
```
