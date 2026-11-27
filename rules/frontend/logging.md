# Frontend Logging

## Scope

适用于 SPA 与 SSR/BFF 的浏览器、Node、PM2 日志边界。SSR/BFF 的完整字段、request id、上游证据链和 PM2 细则见 SSR 变体的 `ssr-observability-and-logging.md`。

## Event Naming

- 事件名统一 `dot.case`：`api.request.failed`、`auth.login.failed`、`bff.upstream.request.completed`、`showcase.service.resolved`；
  段内允许下划线，禁止空格、大写与中文 UI 文案。
- **事件名必须来自目录**：`src/shared/observability/events.ts` 的 `LOG_EVENTS`。调用侧写 `logger.warn(LOG_EVENTS.API_REQUEST_FAILED, ...)`，
  不要直接写字符串字面量；名字一旦发布就是可观测契约，改名要同步 SLS 告警与看板。
- `serverLogger` / `clientLogger` / `logger` 的首参类型是 `LogEventName`，写错或漏登记会在 typecheck 阶段失败；
  `check-logging.mjs` 会再校验一次「引用必须在目录里 / 字面量必须登记且符合命名」。
- 日志只记录排障需要的字段；禁止直接 `JSON.stringify` 整个 request/response/用户对象。
- 错误日志记录 `errorKind`、业务 code、HTTP status、requestId；不记录 token、cookie、密码、完整手机号/邮箱、身份证、银行卡、支付凭证。

## SPA

- 业务代码禁止裸 `console.*`；统一走 `src/shared/services/logger.ts`。
- 开发环境 logger 可输出 `debug/info/warn/error`；生产构建必须通过 Terser `drop_console: true` 删除所有 console。
- 生产允许保留的日志只有两类，且不得包含用户敏感信息：
  - 性能：使用 `logger.performance()`，底层走 `performance.mark`，不是 console；
  - 广告/招聘等营销事件：使用 `logger.marketing()`，底层写 `window.dataLayer`，不是 console。
- 业务日志、接口 payload、用户资料、登录态、cookie、token 不得进入生产 console、dataLayer 或性能 detail。
- 生产构建必须检查 `dist` 中不存在业务 `console.*`；Vite 构建配置必须保留 `drop_console: true`。

## SSR / BFF

- 服务端必须使用 `serverLogger`，浏览器使用 `clientLogger`；禁止裸 console。
- PM2 的 stdout/stderr 合并到单个 JSONL 文件，便于接入阿里云 SLS；不要在应用代码中另写业务日志文件。
- Route Handler、Server Action、gateway 必须记录入口/出口和上游调用摘要；完整 payload 只允许 `debug` 级别、脱敏后临时开启。
- 日志级别：`info` 正常完成，`warn` 降级/拒绝/4xx，`error` 5xx/异常/required 上游失败，`debug` 临时排障。

## Verification

- `scripts/check-logging.mjs`：事件目录登记 / `dot.case` 规范、禁止业务裸 console、检查 SPA `drop_console`、检查 SSR `removeConsole`。
- `scripts/generate-error-codes.mjs`：错误码目录与 `docs/error-codes.md` 新鲜度（pre-commit 与 `quality:check` 都会跑）。
- `src/test/architecture/logging-boundary.test.ts`：检查 logger 文件边界、PM2 单文件 JSONL。
- SPA 生产构建后检查 `dist` 无业务 console；SSR 运行后检查 PM2 只有一个 `.log` 文件且为 JSONL。
