# Environments And Build

## 环境模型

业务环境固定为 `mock`、`dev`、`test`、`prod`，由 `APP_ENV` 与 Vite mode 共同表达。
不要用 `NODE_ENV` 区分业务环境。

提交：

- `.env.example`：完整公开配置契约
- `.env.mock`：仅本地 Prism 值

不提交：

- `.env.dev`
- `.env.test`
- `.env.prod`
- 任何真实凭证和 token

浏览器可见变量必须使用 `VITE_*`。这些值会进入静态 bundle，不得包含 secret。

## 脚本矩阵

```text
pnpm dev          -> Prism + Vite mock
pnpm dev:dev      -> Vite dev mode
pnpm dev:test     -> Vite test mode
pnpm build:dev    -> dist
pnpm build:test   -> dist
pnpm build:prod   -> dist
```

`build:<env>` 通过 `scripts/run-vite-with-env.mjs` 在 Vite 启动前加载 `.env.<env>`。
文件不存在时，CI/CD 必须注入匹配的 `APP_ENV`。

## Base Path

`VITE_APP_BASE_PATH` 是以下位置的共同事实：

- Vite `base`
- React Router `basename`
- `version.json` 中的 `basePath`
- Nginx `location`

值必须是 `/` 或 `/<project-id>/`。任何一处不一致都会造成入口可访问但 assets、deep link
或路由无法匹配。

## Release ID

生产构建优先读取 `VITE_DEPLOYMENT_VERSION`。未注入时，构建脚本生成：

```text
APP_ENV-Git短SHA-UTC构建时间
```

release ID 在一次构建内保持不变，并同时写入浏览器 bundle 和 `version.json`。
不得在进程启动或请求处理中重新生成。

## 静态产物

```text
dist/
  index.html
  version.json
  assets/
```

`dist/` 是 Vite 直接生成的完整静态产物，不做二次封装。`.env.*`、源码、测试、部署脚本和
开发依赖不进入 `dist/`。
