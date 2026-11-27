# 错误码目录

> 本文件由 `pnpm error-codes:table` 生成，请勿手改。新增或修改错误码先改 `src/shared/errors/codes.ts`，
> 再重新生成；`pnpm check:error-codes` 会校验它与代码一致。

成功码：`200`（`SUCCESS_CODE`）。

| 常量 | code | HTTP | 归属 | 文案 key | 场景 |
| --- | --- | --- | --- | --- | --- |
| `AUTH_SESSION_EXPIRED` | `auth.session_expired` | 401 | backend | `api.error.session_expired` | 后端下发的登录态失效码，前端据此清理内存态并跳登录 |
| `COMMON_HTTP_ERROR` | `common.http_error` | — | frontend | `api.error.http` | HTTP 非 2xx 且响应体没有可读信封 |
| `COMMON_INVALID_RESPONSE` | `common.invalid_response` | — | frontend | `api.error.invalid_response` | 响应体不符合 { data, code, codeMsg } 信封契约 |
| `COMMON_NETWORK_ERROR` | `common.network_error` | — | frontend | `api.error.network` | 浏览器网络层失败（fetch 拒绝或离线） |
