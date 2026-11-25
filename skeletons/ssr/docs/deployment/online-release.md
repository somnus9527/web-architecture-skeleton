# SSR 线上发布

本文是通用发布基线。正式应用必须将 `<project-id>`、域名、日志目录和平台账号替换为真实值。
SSR 骨架固定 BFF-only：发布只需要 Next standalone 进程，数据库 migration、worker 和 scheduler 由配套
Java 后端仓库负责。

## 发布模型

```text
服务器或 CI 获取源码
  -> pnpm install --frozen-lockfile
  -> pnpm build:dist:<env>
  -> 整体发布 dist/
  -> bash deploy.sh
  -> Nginx / CDN / WAF 转发
```

默认发布包包含：

```text
server.js
node_modules/
.next/server/
.next/static/
public/
ecosystem.config.cjs
deploy.sh
```

发布包不包含 `.env.*`。生产环境变量由平台、PM2 或 secret manager 注入。

## Release ID 与自动刷新

`NODE_ENV=development` 不需要 `NEXT_DEPLOYMENT_ID`，也不挂载浏览器版本观察器。

`next build` 属于 production 构建。标准构建脚本按以下优先级取得一次不可变 release ID：

1. 使用 CI/CD 已注入的 `NEXT_DEPLOYMENT_ID`
2. 未注入时生成 `APP_ENV-Git短SHA-UTC构建时间`

release ID 在同一份产物内同时用于 Next `deploymentId`、客户端当前版本和
`/<project-id>-api/version`。不要把 `NEXT_DEPLOYMENT_ID` 写进 `.env.*` 或 PM2 运行时变量。

旧标签页每 60 秒检查一次同源版本端点；发现新版本后等待 4 秒并再次确认，版本稳定后通过
`BroadcastChannel` 通知其它标签页并执行整页 reload。页面隐藏、请求失败、响应非法或版本不稳定时
不刷新，同一目标版本最多自动刷新一次。

## 环境变量

至少配置：

```text
APP_ENV
APP_ORIGIN
NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_APP_ORIGIN
BACKEND_API_BASE_URL
PRISM_MOCK_BASE_URL
LOG_LEVEL
SESSION_COOKIE_NAME
SESSION_COOKIE_SECURE
CSRF_ENABLED
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
PORT
PROJECT_ID
```

部署脚本可选覆盖变量：

```text
PM2_APP_NAME
PM2_LOG_DIRECTORY
PM2_ENV_ALLOWLIST
PM2_KILL_TIMEOUT_MS
PM2_MIN_UPTIME_MS
PM2_MAX_RESTARTS
PM2_RESTART_BACKOFF_MS
PM2_MAX_MEMORY_RESTART
PM2_HEALTHCHECK_URL
PM2_HEALTHCHECK_ATTEMPTS
PM2_HEALTHCHECK_INTERVAL_SECONDS
PM2_SAVE_AFTER_HEALTH
```

`ecosystem.config.cjs` 只向应用进程传递固定运行变量和 `PM2_ENV_ALLOWLIST` 显式列出的附加变量，
不得通过展开完整 `process.env` 注入无关凭证。`PM2_ENV_ALLOWLIST` 只写变量名，不写 secret value。

线上统一使用 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm build:dist:prod
```

## PM2

默认应用名为 `<project-id>-web`，日志目录为 `/data/logs/<project-id>-web`，日志文件分为 out 和
error。可通过 `PM2_APP_NAME`、`PM2_LOG_DIRECTORY` 覆盖。

```bash
tar -xf package.tgz -C <release-root>
cd <release-root>
bash deploy.sh
pm2 describe <project-id>-web
```

服务器只能使用固定目录覆盖时，流水线可以继续解压到固定 `<release-root>`；模板不强制 release
目录或软链接。需要接受旧 hash 资源可能残留并由运维定期清理的边界。

`deploy.sh` 在调用 PM2 前执行：

1. 由 `PROJECT_ID` 派生 PM2 应用名和日志目录
2. 创建 PM2 日志目录
3. 执行 `pm2 startOrReload ecosystem.config.cjs --update-env`
4. 轮询 `PM2_HEALTHCHECK_URL`
5. `PM2_SAVE_AFTER_HEALTH=true` 时，探测成功后执行 `pm2 save`

脚本不默认执行 `pm2 delete`，不执行 Nginx 操作，也不包含固定服务器目录。日志目录必须位于发布包
之外，并由平台或 logrotate 负责保留和清理。健康探测失败时脚本退出且不执行 `pm2 save`；代码
release 回退、数据库 forward-fix、version 和业务 smoke 仍由流水线或运维按“发布后检查”完成。

本骨架不得把 migration、worker 或 scheduler 隐藏在 Web 进程启动逻辑中；数据库 schema、连接池、
readiness 和回滚要求由配套 Java 后端仓库的发布流程负责。健康探测只验证当前 Next standalone
进程和 BFF 依赖。

## Nginx

Nginx 应将 `/` 转发给 Next standalone，并将 `/<project-id>-api/**` 一并转发给 Next BFF。`/api/**` 保留给后端或网关，不由前端占用。

必须转发 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`，并按业务设置请求体大小和超时。

## 图片域名白名单

骨架默认允许宽泛远程图片 hostname，以保证复制后可运行。正式应用必须替换为明确白名单。

不配置可能造成任意外部图片被代理、SSR/带宽成本失控、SSRF 风险扩大、CSP/CDN 缓存难以治理，或远程图片在受限环境中无法渲染。

## 发布后检查

```bash
pm2 list
pm2 describe <project-id>-web
bash -n deploy.sh
curl -fsS http://127.0.0.1:${PORT:-3001}/<project-id>-api/health
curl -i http://127.0.0.1:${PORT:-3001}/<project-id>-api/version
test -f server.js
test -f ecosystem.config.cjs
```

版本端点应返回 `{ "releaseId": "..." }`，并包含 `Cache-Control: no-store, max-age=0`。发布验收还需
保留旧版本标签页，确认其在检测周期内自动刷新；打开多个标签页时，应由已确认新版本的标签页广播并
触发其它标签页同步刷新。
