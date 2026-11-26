# 版本端点被 CDN 缓存：诊断与修复

## 1. 问题本质

`version.json` / `/nbf/version` / `/<project-id>-api/version` 是**可变的当前版本指针**：同一个 URL 的响应会随发版变化。只要 CDN 缓存了它，旧标签页就会一直读到旧 release id，自动刷新逻辑再正确也不会触发。

前端的 `fetch(..., { cache: 'no-store' })` 只约束**浏览器 HTTP 缓存**，不约束中间的 CDN、SLB、WAF、反向代理。`?_=timestamp` 也只是额外防御：如果 CDN 的缓存键忽略查询串，它照样命中旧对象。

所以这不是“前端再改一段代码”能单独解决的问题，必须同时处理：

1. 源站响应头；
2. CDN 缓存规则；
3. 发版后刷新 CDN；
4. 发布后从公网验证；
5. 前端请求侧的防御。

## 2. 先诊断

```bash
URL="https://<host>/<base>/version.json"
# SSR: URL="https://<host>/<project-id>-api/version"

# 看响应头
curl -sS -D - -o /tmp/version.json "$URL?_=$(date +%s)"

# 看关键字段
curl -sS -D - -o /dev/null "$URL" | grep -iE 'cache-control|age|x-cache|cf-cache-status|via|expires|pragma|cdn-cache-control|surrogate-control'

# 看 release id
cat /tmp/version.json
```

典型问题信号：

| 信号                                     | 含义                                             |
| ---------------------------------------- | ------------------------------------------------ |
| `Age: 300`                               | 命中 CDN/代理缓存，已缓存 300 秒                 |
| `X-Cache: HIT` / `CF-Cache-Status: HIT`  | CDN 明确命中                                     |
| `Cache-Control: max-age=...`             | 源站或 CDN 仍允许缓存                            |
| `Via: ...`                               | 中间有代理/CDN；不一定命中，但要结合 Age/X-Cache |
| 响应 release id 是旧值，但源站直连是新值 | 基本可判定 CDN 缓存                              |
| `?_=...` 仍返回旧值                      | CDN 忽略查询串，查询参数无效                     |

源站直连对比：

```bash
# SPA：直接读 Nginx 静态文件所在机器
curl -sS -D - http://127.0.0.1/<base>/version.json

# SSR：直连 Next
curl -sS -D - http://127.0.0.1:<port>/<project-id>-api/version
```

## 3. 修复层次

### 3.1 源站：明确禁止缓存

SPA Nginx：

```nginx
location = /<base>/version.json {
    try_files $uri =404;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header CDN-Cache-Control "no-store" always;
    add_header Surrogate-Control "no-store" always;
}
```

SSR Next route：

```ts
return Response.json(
  { releaseId: getDeploymentVersion() },
  {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'CDN-Cache-Control': 'no-store',
      'Surrogate-Control': 'no-store',
    },
  },
);
```

SSR Nginx：

```nginx
location = /<project-id>-api/version {
    proxy_pass http://127.0.0.1:3001;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    add_header CDN-Cache-Control "no-store" always;
    add_header Surrogate-Control "no-store" always;
}
```

注意 Nginx `add_header` 继承规则：location 里一旦有 `add_header`，server 级的安全头不会自动继承；版本 location 要保证需要的头都在同一层或 include 进来。

### 3.2 CDN：精确路径 TTL=0

在 CDN 控制台/API 增加规则，优先级高于默认静态规则：

- 路径：`/<base>/version.json`（SPA）或 `/<project-id>-api/version`（SSR）；
- 缓存行为：不缓存 / TTL 0 / 每次回源；
- 缓存键：不要忽略查询串；如果 CDN 支持“忽略参数”，版本路径必须关闭该选项；
- 如果 CDN 只能按后缀配置，`.json` 不能整体不缓存（会误伤其他 JSON），必须用精确路径规则；
- 如果 CDN 有“缓存遵循源站”，仍要确认它真的识别 `no-store`，不能只看源站头。

### 3.3 发版后刷新 CDN

源站头再正确，如果 CDN 已经缓存了旧对象，仍要刷新。阿里云 CDN 可用 `RefreshObjectCaches`：

```bash
aliyun cdn RefreshObjectCaches \
  --ObjectPath "https://<host>/<base>/version.json" \
  --ObjectType File
```

如果前端请求带 `?_=timestamp`，而 CDN 按查询串缓存，可考虑 `--ObjectType IgnoreParams` 刷新“去参数”的 URL；具体能力以 CDN 产品为准。

刷新有生效延迟（阿里云文档说明通常数分钟），所以：

- 发布流水线不要假设“刷新调用成功 = 立即生效”；
- 发版后等 5–10 分钟再验证旧标签页；
- 重要发布可先刷新版本 URL，再切流量/再观察。

本仓库 `scripts/deploy.sh` 支持：

```bash
CDN_PURGE_CMD='aliyun cdn RefreshObjectCaches --ObjectPath "$HEALTH_URL" --ObjectType File' \
APP_ROOT=/var/www/<app> bash scripts/deploy.sh release ...
```

`CDN_PURGE_CMD` 会拿到 `RELEASE_ID`、`APP_ROOT`、`HEALTH_URL` 环境变量；失败会让部署脚本返回非 0，提醒流水线重试或人工处理。

### 3.4 前端请求侧：额外防御

- 每次请求带唯一参数：`?_=<Date.now()>`，不是启动时生成一次；
- `cache: 'no-store'`；
- 请求头 `Cache-Control: no-cache`、`Pragma: no-cache`；
- 读取响应头 `Age`、`X-Cache`/`CF-Cache-Status`，命中缓存时记录 `frontend_version_cache_risk` 诊断；
- 这些只是“降低概率 + 可观测”，不能替代 3.1–3.3。

### 3.5 发布后验证

```bash
node scripts/check-version-cache.mjs \
  --url "https://<host>/<base>/version.json" \
  --expected-release-id "<新 release id>"
```

检查项：

- HTTP 200；
- `releaseId` 与新版本一致；
- `Cache-Control` 含 `no-store`/`no-cache`；
- `Age` 为 0 或缺省；
- `X-Cache`/`CF-Cache-Status` 不是 `HIT`。

失败时先刷新 CDN，再查 CDN 规则和源站头，不要先怀疑前端 watcher。

## 4. 如果 CDN 无法配置

如果 CDN 是共享平台、无法给单个路径关缓存，也没有刷新 API：

1. 把版本端点迁到明确不缓存的域名/路径（例如独立的 `status.example.com` 或网关的 `/api/version`，并让 CDN 对该路径 bypass）。
2. 用 HTML 入口作为第二指针：`index.html` 不缓存并注入 `<meta name="release-id">`，watcher 同时检查 HTML；但 HTML 同样可能被 CDN 缓存，不是绝对方案。
3. 用 SSE/WebSocket 推送版本变化；需要额外基础设施，不适合作为默认。
4. 换 CDN 或让运维加规则；前端无法单独保证。

结论：**CDN 缓存不是前端代码能单独修复的；正确做法是“源站 no-store + CDN 精确路径 TTL=0 + 发版刷新 + 公网 header 验证 + 前端每次请求 cache-buster/诊断”。**

## 5. 当前项目现状

- 规范已存在：`docs/rules/frontend/frontend-release-refresh.md` 的 `Cache And Proxy` 章节。
- SPA/SSR 都实现了 VersionWatcher：60 秒递归检查、4 秒二次确认、`BroadcastChannel`、`sessionStorage` 防循环。
- SPA 用 `/version.json`，SSR 用 `/<project-id>-api/version`；两者都设置了 `no-store`。
- `wgcards-b2b-web` 在启动时用 `version.json?t=${Date.now()}`，但 `t` 只生成一次，不是每次请求都变；CDN 仍可能缓存该固定 URL。
- `lanox-web` 的 Nginx 示例已经对 `/nbf/version` 做 `proxy_no_cache`/`proxy_cache_bypass`，但前面如果有 CDN，仍要单独配置 CDN 规则。
- 骨架已有 `scripts/deploy.sh`、`scripts/check-version-cache.mjs`；发版时建议接 `CDN_PURGE_CMD` 并跑公网检查。
