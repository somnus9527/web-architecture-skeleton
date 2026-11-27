# React SPA Application Skeleton

这是一个可复制的 React SPA 项目骨架，不是正式业务应用，也不以任何业务服务作为后续规则来源。

骨架默认提供：

- Vite 8、React 19、TypeScript strict
- React Router history 模式和可配置部署 base path
- Ant Design 6、原生 CSS + CSS 变量、i18next
- 统一 API client、错误边界和日志边界
- OpenAPI + Prism 本地 mock
- 构建期 release ID、`version.json` 和旧标签页自动刷新
- Vite 标准静态构建、Nginx history fallback 和发布 reload
- Vitest、Testing Library、架构测试、ESLint、Prettier、Husky 和 commitlint

## 复制后的第一步

复制骨架后，先使用仓库内的初始化 skill，输入一个不带 `-web` 的小写 kebab-case 基础项目名：

```text
$initialize-spa-project --no-backend supply-chain
```

也可以直接使用自然语言：

```text
帮我初始化这个纯前端项目，项目名称是 supply-chain
```

初始化器会自动追加 `-web`，同步应用标题、base path、版本刷新标识和项目文档。API upstream、
正式域名与 Nginx server name 仍由发布环境配置。已有配套后端时改用
`--backend-root ../<backend-project>`，不要使用 `--no-backend`。

默认派生关系：

```text
package name      = <project-id>-web
browser base path = /<project-id>/
version endpoint  = /<project-id>/version.json
```

`spa-app`、`spa-app-web` 和 `SPA Application` 都是待替换占位值。

## 项目绑定

本仓库只承载前端与共享规则；Java 后端规则不随前端骨架分发。

- 前端根：当前仓库。
- 后端根与交付文档根：按项目实际路径绑定，没有配套后端时为 `N/A` 与当前仓库。
- 派生项目必须记录实际相对路径，不得写个人机器绝对路径。

## 同步架构规范

正式项目可以从上游 `skeletons/spa/docs/rules/` 检查并同步最新规范：

```text
$sync-architecture-rules
```

同步器不会合并骨架代码，也不会覆盖项目命名、初始化记录、ADR 或部署文档。

## 本地命令

```bash
pnpm install --frozen-lockfile
pnpm env:init dev
pnpm env:init test
pnpm env:init prod
pnpm dev
pnpm dev:dev
pnpm dev:test
pnpm mock:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm check:error-codes
pnpm check:licenses
pnpm check:sri
pnpm licenses:notice
pnpm test:visual   # 关键页截图基线（Linux 容器，见 scripts/run-visual.sh）
pnpm test:a11y   # 真实 Chromium + axe；首次需 pnpm exec playwright install chromium
pnpm quality:check
```

`pnpm dev` 默认同时启动 Prism 与 Vite mock 模式。`.env.dev`、`.env.test`、`.env.prod` 不提交，
本地用 `pnpm env:init <env>` 生成，CI/CD 直接注入。`quality:check` 中的 `build:prod` 需要 `.env.prod`。

## 构建与发布

```bash
pnpm build:prod
bash scripts/deploy.sh
```

`build:prod` 经 `run-vite-with-env.mjs` 加载 `.env.prod` 并注入 release ID，静态产物直接输出到 `dist/`：

```text
Vite build
  -> dist/
  -> index.html
  -> version.json
  -> assets/
```

`build:prod` 在构建前读取 `.env.prod`；该文件不存在时，要求 CI/CD 至少注入
`APP_ENV=prod` 及所需 `VITE_*` 变量。

同一次构建只生成一个 release ID。优先使用 CI/CD 注入的
`VITE_DEPLOYMENT_VERSION`，否则自动生成 `APP_ENV-Git短SHA-UTC构建时间`。
该 ID 同时固化到浏览器 bundle 和 `version.json`。

浏览器每 60 秒检查一次 `version.json`。发现不同版本后等待 4 秒再次确认，确认稳定后通过
`BroadcastChannel` 同步其它标签页并整页刷新。

发布平台负责将完整 `dist/` 静态产物部署到 Nginx 配置的目录。产物部署完成后，
`scripts/deploy.sh` 只负责校验并 reload Nginx：

```bash
bash scripts/deploy.sh
```

SPA 不启动 PM2 或 Node 静态服务，也不执行二次发布包封装。

详见 [`docs/deployment/online-release.md`](./docs/deployment/online-release.md)。

## 目录约定

```text
src/app/        全局 Provider、主题和应用装配
src/router/     路由定义与 base path 接线
src/features/   按业务域组织的页面、组件、hook、service 和类型
src/shared/     跨 feature 共享的组件、配置、运行时和 service
src/locale/     i18next 词条
src/test/       单测、组件测试和架构测试
mocks/          OpenAPI/Prism mock materialize
scripts/        mock、环境构建和 Nginx reload 脚本
docs/           规范、初始化、ADR 和部署文档
```

页面不直接调用 `fetch`；HTTP 调用统一经过 `src/shared/tools/api-client.ts` 和
feature service。路由保持薄层，业务状态与副作用放在 feature hook/store。

## 规范入口

- 协作入口：[`AGENTS.md`](./AGENTS.md)
- SPA 基线：[`docs/rules/frontend/spa-project-baseline.md`](./docs/rules/frontend/spa-project-baseline.md)
- 初始化清单：[`docs/initialization/spa-app-initialization.md`](./docs/initialization/spa-app-initialization.md)
- 构建发布：[`docs/deployment/online-release.md`](./docs/deployment/online-release.md)
- 发布刷新：[`docs/rules/frontend/frontend-release-refresh.md`](./docs/rules/frontend/frontend-release-refresh.md)
- 验证清单：[`docs/rules/frontend/spa-verification.md`](./docs/rules/frontend/spa-verification.md)
- 共享规则：[`docs/rules/shared/`](./docs/rules/shared/)
