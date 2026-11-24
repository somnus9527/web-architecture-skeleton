# SPA Project

## Always-on

- 当前仓库是 React SPA 骨架。
- 路由使用 Vite base 与 React Router basename 的同一部署路径。
- 应用运行时只包含浏览器代码，不新增 BFF 或服务端业务层。
- feature 内按 pages、components、hooks、services、types 和 store 拆分。
- shared 只放跨 feature 稳定复用能力。

## Routing

- 新增 feature 或调整目录前，读取 `docs/rules/frontend/frontend-architecture.md`。
- 修改组件和 hook 前，读取 `docs/rules/frontend/frontend-react.md`。
- 修改 API 与 mock 前，读取 `docs/rules/frontend/api-contracts.md` 和
  `docs/rules/frontend/mock-and-integration.md`。
- 修改环境、base path 和发布能力前，读取 `docs/rules/frontend/environments-and-build.md`。

## Rule references

- SPA baseline: `docs/rules/frontend/spa-project-baseline.md`
- Architecture: `docs/rules/frontend/frontend-architecture.md`
- React: `docs/rules/frontend/frontend-react.md`
- Environment and build: `docs/rules/frontend/environments-and-build.md`
- Release: `docs/deployment/online-release.md`
