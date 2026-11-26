# SSR Trace ID 与后端 TLog 串联实施方案

- 日期：2026-11-26
- 仓库：`/Users/somnuszyy9527/workspace/test/web-architecture-skeleton`
- 方案落库基线：`dbe948cb docs: 落 SSR traceId 串联方案并补齐日志检查`；代码现状以当前 `git rev-parse HEAD` 为准。
- 状态：方案待实施；本文只定义设计与验收，不改代码。
- 关联文档：[SSR 日志规则](../../rules/ssr/ssr-observability-and-logging.md)、[SSR BFF 边界](../../rules/ssr/ssr-bff-boundaries.md)、[日志规则](../../rules/frontend/logging.md)

## 1. 背景

当前 SSR 已经记录 `requestId`、`traceparent` 和后端返回的 `tlogTraceId`，但链路只完成了“人工可关联”，还没有做到“端到端自动串起来”：

- proxy 不生成/校验 request id 与 traceparent；
- 页面请求和客户端 API 请求可能各自生成不同 requestId；
- 后端 `tlogTraceId` 只写日志，不返回浏览器；
- `X-Trace-Id` 与 `requestId` 同名混用，语义不清晰；
- 入口 308/404/CORS 响应没有 request id。

目标：一次浏览器请求在 Next、BFF、后端 TLog、SLS 之间共享一条可检索的 trace 证据链，同时不泄漏 cookie/token/PII。

## 2. 现状链路

```text
浏览器 / Nginx
  x-request-id / x-trace-id / traceparent
        ↓
proxy
  只处理语言头，不生成 request id，不生成 traceparent
        ↓
createRequestContext()
  requestId = x-request-id || x-trace-id || randomUUID()
  traceparent = 入站值（原样，不校验）
  tlogTraceId = 入站 tlogTraceId（如果上游传了）
        ↓
Server Component / Route Handler / Server Action
  同一 context 向下传
        ↓
gateway buildHeaders()
  X-Request-Id = requestId
  X-Trace-Id = requestId
  traceparent = context.traceparent（有才传）
        ↓
后端
  响应头 tlogTraceId
        ↓
rememberTlogTraceId()
  context.tlogTraceId = 后端值
        ↓
serverLogger
  requestId + upstreamTraceId + traceparent
        ↓
BFF 响应
  X-Request-Id + body.requestId
  不返回 tlogTraceId
```

关键文件：

- `skeletons/ssr/src/proxy.ts`
- `skeletons/ssr/src/bff/shared/request-context.ts`
- `skeletons/ssr/src/bff/shared/http-client.ts`
- `skeletons/ssr/src/bff/shared/http-response.ts`
- `skeletons/ssr/src/bff/shared/logger/server-logger.ts`
- `skeletons/ssr/src/app/[locale]/page.tsx`

## 3. ID 语义定稿

| 字段          | 语义                                   | 生成方                         | 传输                                           |
| ------------- | -------------------------------------- | ------------------------------ | ---------------------------------------------- |
| `requestId`   | Next/BFF 请求关联 ID，不是后端 traceId | proxy 入口生成或沿用可信入口值 | `X-Request-Id` 请求/响应；BFF body             |
| `traceparent` | W3C 分布式 trace 上下文                | proxy 缺失时生成，合法时透传   | W3C `traceparent` 请求头                       |
| `tlogTraceId` | Java TLog 链路 ID                      | 后端响应头                     | BFF 内部 context；响应 `X-TLog-Trace-Id`；日志 |
| `X-Trace-Id`  | 兼容别名，等同 `requestId`             | 同 requestId                   | 继续发给后端，标记 deprecated                  |

规则：

- 新代码只把 `X-Request-Id` 当请求关联 ID；不要把 `X-Trace-Id` 当 TLog ID。
- `tlogTraceId` 只接受后端响应头，**不接受客户端入站值**；入站同名头必须剥离。
- `requestId` 允许客户端/网关传入，但只作为关联 ID，不参与鉴权。
- `traceparent` 只在格式合法时复用；非法值必须丢弃并重新生成，不能透传。

## 4. 目标链路

```text
Nginx / Gateway
  - 统一注入/覆盖 X-Request-Id
  - 缺失或非法 traceparent 时注入合法值
  - 剥离客户端伪造的 tlogTraceId
        ↓
Next proxy
  - 读取/生成 requestId，写入 forwarded request headers
  - 读取/生成 traceparent，写入 forwarded request headers
  - 响应头也写 X-Request-Id
        ↓
createRequestContext()
  - requestId 优先取 proxy 注入值
  - traceparent 只接受合法 W3C 值
  - tlogTraceId 入站值一律丢弃
        ↓
RSC / Route Handler / Server Action
  - 同一请求共享一个 context
        ↓
gateway
  - X-Request-Id
  - X-Trace-Id（兼容）
  - traceparent
  - tracestate（有则透传）
        ↓
后端
  - 继续 traceparent
  - 返回 tlogTraceId
        ↓
BFF
  - 回填 context.tlogTraceId
  - 响应头：X-Request-Id、X-TLog-Trace-Id
  - body：requestId
  - 日志：requestId、traceparent、tlogTraceId
        ↓
浏览器
  - 首屏 HTML 注入 <meta name="request-id">
  - 客户端 API 请求带 X-Request-Id
  - 错误提示可展示 requestId
```

## 5. 具体实现

### 5.1 proxy 生成/校验

文件：`skeletons/ssr/src/proxy.ts`

新增纯函数（建议放 `src/shared/trace/` 或 `src/bff/shared/trace/`，proxy 可 import）：

- `normalizeRequestId(value): string | undefined`
  - 长度 8–128；
  - 只允许 `[A-Za-z0-9._:-]`；
  - 不允许换行/空格。
- `isValidTraceparent(value): boolean`
  - 严格匹配 `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$`；
  - trace-id 和 parent-id 不能全 0。
- `createTraceparent(): string`
  - Web Crypto 生成 16 字节 trace-id、8 字节 parent-id；
  - flags 默认 `01`（sampled），后续可接采样策略；
  - 输出 `00-<32hex>-<16hex>-01`。
- `resolveTraceContext(requestHeaders): { requestId, traceparent, tracestate? }`
  - `requestId = normalizeRequestId(x-request-id) ?? randomUUID()`；
  - `traceparent = valid(inbound) ? inbound : createTraceparent()`；
  - `tracestate` 仅在 traceparent 合法时透传，长度上限 512。

proxy 行为：

- 对 `NextResponse.next`、308、404、OPTIONS 都设置 `X-Request-Id` 响应头。
- `buildForwardedRequestHeaders` 写入 `X-Request-Id`、`traceparent`、合法 `tracestate`。
- 删除入站 `tlogTraceId`，避免客户端伪造。
- 保留 `x-public-locale` 的“先删除再写入”逻辑。

### 5.2 request context

文件：`skeletons/ssr/src/bff/shared/request-context.ts`

- `createRequestContext` 只读取 proxy 注入的 `X-Request-Id`、`traceparent`、`tracestate`。
- 入站 `tlogTraceId` 不再读取。
- 增加 `tracestate?: string`。
- `requestId` 失效时回退 `randomUUID()`，并记录一次 `trace_context_invalid` warn（避免静默）。
- `rememberTlogTraceId` 保持只接受后端响应头，校验长度/字符集。

### 5.3 出站

文件：`skeletons/ssr/src/bff/shared/http-client.ts`

- `buildHeaders`：
  - `X-Request-Id`、`X-Trace-Id` 保持兼容；
  - `traceparent` 必传；
  - `tracestate` 有则传；
  - 不把 `tlogTraceId` 发给后端。
- 响应头读取兼容大小写：`tlogTraceId` / `TlogTraceId` / `X-TLog-Trace-Id`。
- 日志字段统一为：
  - `requestId`
  - `traceparent`
  - `tlogTraceId`（替代 `upstreamTraceId`；保留一个版本兼容别名）

### 5.4 响应头

文件：`skeletons/ssr/src/bff/shared/http-response.ts`

成功/错误响应都设置：

```text
X-Request-Id: <requestId>
X-TLog-Trace-Id: <tlogTraceId>   # 有且格式合法时
Cache-Control: no-store
```

body 保留 `requestId`；不把 `traceparent`、cookie、authorization 放进 body。

### 5.5 页面到客户端 API

- 根 layout 读取 proxy 注入的 requestId，在 `<head>` 注入：

```html
<meta name="request-id" content="..." />
```

- 客户端 `api-client` 读取该 meta，并在请求头带 `X-Request-Id`；没有 meta 时生成一次会话级 ID。
- 这样页面 RSC 读取与后续 `/ssr-app-api/**` 请求共享同一个关联 ID。
- 不把 `traceparent` 暴露给浏览器；traceparent 由服务端链路维护。

### 5.6 日志字段

`serverLogger` 统一字段：

- `requestId`
- `traceparent`
- `tlogTraceId`（上游返回后）
- `routeId`、`span`、`method`、`path`、`status`、`durationMs`
- `actorType` / `hasSessionCookie`，不记录原始 cookie/token

SLS 查询示例：

```text
requestId: "xxx"
tlogTraceId: "yyy"
```

如果一个请求有多个上游调用，`tlogTraceId` 记录最后一个/主上游值，另外保留 `upstreamTraceIds: string[]`（可选）。

## 6. 兼容与迁移

- `X-Trace-Id` 至少保留一个发布周期，标记 deprecated。
- `upstreamTraceId` 日志字段保留一个版本，之后统一为 `tlogTraceId`。
- 后端若暂不支持 W3C `traceparent`，仍可通过 `X-Request-Id` 关联；traceparent 不影响主流程。
- 多上游调用时不要覆盖 `requestId`；只记录每个上游的 `tlogTraceId`。
- 入口代理如果不方便注入，可先由 Next proxy 生成；后续再把生成职责上移到 Nginx。

## 7. 测试与验收

必须新增/更新：

- `trace-context` 单元测试：
  - 合法 requestId 透传；
  - 非法/超长/换行 requestId 回退；
  - 合法 traceparent 透传；
  - 非法 traceparent 重新生成；
  - 全 0 trace-id/parent-id 拒绝；
  - `tracestate` 长度限制。
- proxy 测试：
  - `/` 308 响应带 `X-Request-Id`；
  - 正常页面 forwarded headers 有 `X-Request-Id`、`traceparent`；
  - 404/OPTIONS 也有 requestId；
  - 入站 `tlogTraceId` 被删除。
- context/gateway 测试：
  - 出站 headers 含 requestId、traceparent、tracestate；
  - 后端 `tlogTraceId` 回填；
  - 响应头含 `X-Request-Id`、`X-TLog-Trace-Id`。
- 页面/客户端测试：
  - HTML 有 `meta[name=request-id]`；
  - 客户端 API 请求带同一个 `X-Request-Id`。
- 运行时 smoke：
  - `curl -D - /zh-CN` 检查 `X-Request-Id` 和 meta；
  - `curl` BFF 检查 `X-TLog-Trace-Id`（mock 后端返回时）；
  - SLS 可按 `requestId` 和 `tlogTraceId` 查询。

验收标准：

1. 无入站 ID 时，proxy 生成一次，所有下游日志一致；
2. 有合法入站 ID 时透传，不重新生成；
3. 非法 traceparent 不透传；
4. 后端 TLog ID 出现在日志和响应头；
5. 页面与客户端 API 共享 requestId；
6. 不记录 cookie/token/PII；
7. 现有 SEO、日志、UI 门禁不回归。

## 8. 实施顺序

1. 新增 trace 纯函数 + 单元测试。
2. proxy 接入 requestId/traceparent，补 308/404/OPTIONS 响应头。
3. request-context 改为只信任 proxy 注入值。
4. gateway 出站 traceparent/tracestate + 后端 tlogTraceId 回填。
5. BFF 响应头 + 日志字段统一。
6. 页面 meta + 客户端 API `X-Request-Id`。
7. 更新架构测试、运行时 smoke、规则文档。
8. 全量 typecheck / lint / test / build / gates。

## 9. 风险

- **伪造 ID**：requestId/traceparent 只用于关联，不参与鉴权；入口仍应覆盖不可信值。
- **隐私**：traceparent/tracestate 不得包含用户信息；tlogTraceId 必须经过格式校验。
- **多上游**：一个 BFF 请求可能调多个后端；不要用最后一个 traceId 覆盖主 requestId，保留列表或主上游。
- **后端不支持 W3C**：traceparent 会被忽略，但 X-Request-Id 仍可关联。
- **proxy 运行时**：Next 16 proxy 可能运行在 Edge/Node，只使用 Web Crypto 和标准 Headers。
- **日志成本**：debug payload 仍受 LOG_LEVEL 控制，生产默认 info。

## 10. 新 Session 交接 Prompt

```text
你接手的是 /Users/somnuszyy9527/workspace/test/web-architecture-skeleton，当前 main 基线以 `git rev-parse HEAD` 为准（方案落库提交 dbe948cb）。

先完整阅读：
- docs/plans/2026-11-26-ssr-trace-id-correlation.md
- rules/ssr/ssr-observability-and-logging.md
- rules/ssr/ssr-bff-boundaries.md
- skeletons/ssr/src/proxy.ts
- skeletons/ssr/src/bff/shared/request-context.ts
- skeletons/ssr/src/bff/shared/http-client.ts
- skeletons/ssr/src/bff/shared/http-response.ts
- skeletons/ssr/src/bff/shared/logger/server-logger.ts
- skeletons/ssr/src/shared/logger/logger-core.ts
- skeletons/ssr/src/app/[locale]/page.tsx

任务：按方案实现 SSR trace 链路。
目标：一次浏览器请求的 requestId、W3C traceparent、后端 TLog traceId 在 Next proxy、RSC/BFF、gateway、后端、SLS 之间可自动关联；不泄漏 cookie/token/PII。

必须实现：
1. proxy 生成/校验 X-Request-Id，缺失或非法 traceparent 时生成合法 W3C 值；308/404/OPTIONS 也返回 X-Request-Id；入站 tlogTraceId 剥离。
2. request-context 只信任 proxy 注入的 X-Request-Id/traceparent/tracestate；requestId 非法回退 randomUUID。
3. http-client 出站带 X-Request-Id、X-Trace-Id（兼容）、traceparent、tracestate；读取后端 tlogTraceId（大小写兼容）。
4. BFF 成功/错误响应带 X-Request-Id 和 X-TLog-Trace-Id；body 保留 requestId。
5. 页面根 layout 注入 <meta name="request-id">；客户端 API 请求带同一 X-Request-Id。
6. 日志字段统一 requestId / traceparent / tlogTraceId；保留一个版本的 upstreamTraceId 兼容别名。
7. 更新架构测试和运行时检查，覆盖方案第 7 节全部场景。
8. 更新相关规则文档，保持与代码一致。

约束：
- 不引入 OpenTelemetry SDK；先用 Web Crypto/标准 Headers。
- 不改 SEO 路由、UI 组件、日志单文件策略、Tailwind/MUI 约束。
- 不提交、不 push，完成实现和验证后报告修改文件、测试结果、未覆盖风险。
- 遵循仓库现有 TypeScript/ESLint/Prettier/架构测试规范；所有新增文件中文注释，interface 用 I 前缀。
- 先读再改；不要覆盖用户未提交的其它修改。
- 必须跑：spa/ssr 的 typecheck、lint、test、build、check:gates、check:security；SSR 还要跑 check:seo:runtime 或等价 smoke。

验收：
- 无入站 ID 时 proxy 生成一次，页面、BFF、上游日志共享同一 requestId；
- 合法入站值透传，非法 traceparent 不透传；
- 后端 TLog ID 出现在日志和 X-TLog-Trace-Id；
- 页面与客户端 API 共享 requestId；
- 不记录 cookie/token/PII；
- 所有现有门禁通过。
```
