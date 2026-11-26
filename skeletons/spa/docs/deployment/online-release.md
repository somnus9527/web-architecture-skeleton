# SPA 线上发布

本文定义 Vite 静态构建、Nginx 托管和 API 代理的通用发布基线。正式应用必须替换项目占位值。

## 脚本化发布（CI/CD）

```bash
# 构建机：产出不可变 tar.gz
bash scripts/build.sh --env prod --artifact ./spa-<release>.tar.gz --release-id <release-id>

# 部署机：解包、切软链、健康检查、reload
APP_ROOT=/var/www/<project-id> bash scripts/deploy.sh release \
  --artifact ./spa-<release>.tar.gz --release-id <release-id> \
  --health-url https://<public-host>/<project-id>/version.json

# 回滚
APP_ROOT=/var/www/<project-id> bash scripts/deploy.sh rollback
```

发布根目录由 `--app-root`/`APP_ROOT` 指定；不需要 `rsync`。服务器不允许软链时见
[`no-symlink-release.md`](./no-symlink-release.md)。

## 发布模型

> 服务器不允许软链时，按 [`no-symlink-release.md`](./no-symlink-release.md) 的固定目录/入口原子替换或版本目录模型发布。
> 服务器允许软链时，按 [`symlink-release.md`](./symlink-release.md) 由 `deploy.sh` 完成发布与回滚。
> 线上回滚命令速查见 [`rollback-quick-reference.md`](./rollback-quick-reference.md)。
> `version.json` / 版本端点被 CDN 缓存导致不刷新？见 [`version-endpoint-cache.md`](./version-endpoint-cache.md)。

```text
CI/CD 获取源码
  -> pnpm install --frozen-lockfile
  -> bash scripts/build.sh --env prod --artifact <tar.gz> --release-id <id>
  -> bash scripts/deploy.sh release --app-root <dir> --artifact <tar.gz> --release-id <id>
  -> 解包、切 current、健康检查、nginx -t && reload
```

`dist/` 是 Vite 直接生成的静态产物：

```text
dist/
  assets/
  index.html
  version.json
```

`build.sh` 只做门禁、构建、校验和打包；`deploy.sh` 负责部署与回滚，不把运行脚本复制进 `dist/`，也不启动 Node 静态服务或 PM2。

## 构建契约

`scripts/run-vite-with-env.mjs` 在启动 Vite build 前加载对应环境，并取得一次不可变 release ID：

1. 优先使用 CI/CD 注入的 `VITE_DEPLOYMENT_VERSION`
2. 未注入时生成 `APP_ENV-Git短SHA-UTC构建时间`

Vite 将 release ID 与规范化后的 base path 写入 `dist/version.json`，同时把 release ID 固化到
浏览器 bundle。

构建命令：

```bash
pnpm install --frozen-lockfile
bash scripts/build.sh --env prod --artifact ./spa-<release>.tar.gz --release-id <release-id>
```

`build.sh` 会串联 `check:gates`、`check:security`、`typecheck`、`lint`、`test`，并把 release id 同时写入
`VITE_DEPLOYMENT_VERSION`、`version.json` 和 `build-meta.json`。需要跳过检查时用 `--skip-checks`。

本地没有 `.env.prod` 时，可以用平台等价注入验证：

```bash
APP_ENV=prod \
VITE_APP_TITLE="SPA Application" \
VITE_APP_BASE_PATH=/spa-app/ \
VITE_API_BASE_URL=/api \
pnpm build:prod
```

## 发布与重载

发布机执行：

```bash
APP_ROOT=/var/www/<project-id> bash scripts/deploy.sh release \
  --artifact ./spa-<release>.tar.gz --release-id <release-id> \
  --health-url https://<public-host>/<project-id>/version.json
```

`deploy.sh` 完成解包、校验、切 `current`、健康检查和 Nginx reload；`--no-reload` 可把 reload 交给运维。
回滚使用 `bash scripts/deploy.sh rollback --app-root <dir>`，不需要重新构建。

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
