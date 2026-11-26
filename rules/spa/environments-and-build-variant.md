## Environments And Build（SPA 变体）

### 3.1 SPA（Vite，`--mode` 原生加载 `.env.<env>`）

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k -n mock,vite -c magenta,green \"pnpm mock:dev\" \"node --env-file=.env.mock scripts/start-vite-mock.mjs\"",
  "dev:dev": "vite --host 127.0.0.1 --mode dev",
  "dev:test": "vite --host 127.0.0.1 --mode test",
  "mock:dev": "node --env-file=.env.mock scripts/start-prism-mock.mjs",
  "build:dev": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.dev build --mode dev",
  "build:test": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.test build --mode test",
  "build:prod": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.prod build --mode prod",
  "preview": "vite preview",
}
```

- SPA 的 `VITE_*` 在 build 时烤进产物 → **每环境一份构建产物**（`build:test` / `build:prod`），
  不存在“一份产物多环境”。
- `build:<env>` 必须经 `scripts/run-vite-with-env.mjs` 加载 `.env.<env>` 并生成一次 release ID；直接
  调 `vite build` 会绕过 release ID 和 base path 注入。
- **不引入运行时 `config.json` 注入**：公共配置一律走构建期 `.env.<env>`，按环境分别构建。

## Base Path

`VITE_APP_BASE_PATH` 是以下位置的共同事实：

- Vite `base`
- React Router `basename`
- `version.json` 中的 `basePath`
- Nginx `location`

值必须是 `/` 或 `/<project-id>/`。任何一处不一致都会造成入口可访问但 assets、deep link 或路由无法
匹配。

## Release ID

生产构建优先读取 CI/CD 注入的 `VITE_DEPLOYMENT_VERSION`；未注入时由 `run-vite-with-env.mjs` 生成：

```text
APP_ENV-Git短SHA-UTC构建时间
```

release ID 在一次构建内保持不变，并同时写入浏览器 bundle 与 `dist/version.json`。不得在进程启动或
请求处理中重新生成。

## 静态产物

```text
dist/
  index.html
  version.json
  assets/
```

`dist/` 是 Vite 直接生成的完整静态产物，不做二次封装。`.env.*`、源码、测试、部署脚本和
开发依赖不进入 `dist/`。
