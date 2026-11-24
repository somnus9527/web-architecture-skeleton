# SPA 线上发布

本文定义 Vite 静态构建、Nginx 托管和 API 代理的通用发布基线。正式应用必须替换项目占位值。

## 发布模型

```text
CI/CD 获取源码
  -> pnpm install --frozen-lockfile
  -> pnpm build:prod
  -> 将完整 dist/ 部署到 Nginx 静态目录
  -> bash scripts/deploy.sh
  -> nginx -t
  -> nginx -s reload
```

`dist/` 是 Vite 直接生成的静态产物：

```text
dist/
  assets/
  index.html
  version.json
```

不增加二次打包脚本，不把 `deploy.sh` 复制进 `dist/`，也不启动 Node 静态服务或 PM2。

## 构建契约

`scripts/run-vite-with-env.mjs` 在启动 Vite build 前加载对应环境，并取得一次不可变 release ID：

1. 优先使用 CI/CD 注入的 `VITE_DEPLOYMENT_VERSION`
2. 未注入时生成 `APP_ENV-Git短SHA-UTC构建时间`

Vite 将 release ID 与规范化后的 base path 写入 `dist/version.json`，同时把 release ID 固化到
浏览器 bundle。

构建命令：

```bash
pnpm install --frozen-lockfile
pnpm build:prod
```

本地没有 `.env.prod` 时，可以用平台等价注入验证：

```bash
APP_ENV=prod \
VITE_APP_TITLE="SPA Application" \
VITE_APP_BASE_PATH=/spa-app/ \
VITE_API_BASE_URL=/api \
pnpm build:prod
```

## 发布与重载

发布平台负责把同一次构建产生的完整 `dist/` 部署到 Nginx 静态目录。静态文件就位后执行：

```bash
bash scripts/deploy.sh
```

脚本不接收动作参数，也不复制或删除静态文件，只执行：

```bash
nginx -t && nginx -s reload
```

## Nginx 契约

Nginx 负责：

- 直接提供 `dist/` 中的 `index.html`、`version.json` 和 hash assets
- 对 history 路由执行 `try_files ... /<project-id>/index.html`
- 将 `/api/` 代理到后端 upstream
- 禁止缓存 `index.html` 和 `version.json`
- 对 `assets/**` 设置一年 immutable 缓存

`VITE_APP_BASE_PATH`、React Router basename 和 Nginx location 必须一致。

## 发布后检查

```bash
test -f dist/index.html
test -f dist/version.json
bash -n scripts/deploy.sh
nginx -t
curl -I http://127.0.0.1/<project-id>/
curl -i http://127.0.0.1/<project-id>/version.json
curl -I http://127.0.0.1/<project-id>/workspace
curl -I http://127.0.0.1/api/health
```

`workspace` 等 history 路由应返回 SPA `index.html`。入口和版本响应必须带
`Cache-Control: no-store, max-age=0`，hash assets 必须带长期 immutable 缓存。
