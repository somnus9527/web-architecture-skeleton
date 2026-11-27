# 错误码目录

> 本文件由 `pnpm error-codes:table` 生成，请勿手改。新增或修改错误码先改 `src/shared/errors/codes.ts`，
> 再重新生成；`pnpm check:error-codes` 会校验它与代码一致。

成功码：`200`（`SUCCESS_CODE`）。

| 常量 | code | HTTP | 归属 | 文案 key | 场景 |
| --- | --- | --- | --- | --- | --- |
| `AUTH_SESSION_EXPIRED` | `auth.session_expired` | 401 | backend | — | 后端下发的登录态失效码，BFF 归一为 401 |
| `AUTH_SESSION_REQUIRED` | `auth.session_required` | 401 | bff | — | 请求缺少会话 cookie |
| `BFF_ABORTED` | `bff.aborted` | 499 | bff | — | 请求被取消（客户端断开） |
| `BFF_BINARY_RESPONSE` | `bff.binary_response` | 502 | bff | — | 期望 JSON 却收到二进制响应 |
| `BFF_EMPTY_DATA` | `bff.empty_data` | 502 | bff | — | data 为空但端点声明必填 |
| `BFF_INTERNAL_ERROR` | `bff.internal_error` | 500 | bff | — | 未归类异常，响应不带堆栈 |
| `BFF_INVALID_GATEWAY_PATH` | `bff.invalid_gateway_path` | 500 | bff | — | 出站路径未通过 resolveOutboundUrl 校验 |
| `BFF_JSON_PARSE_ERROR` | `bff.json_parse_error` | 502 | bff | — | 响应体不是合法 JSON |
| `BFF_MALFORMED_DATA` | `bff.malformed_data` | 502 | bff | — | 响应 data 形状不符合 DTO 契约 |
| `BFF_MALFORMED_WRAPPER` | `bff.malformed_wrapper` | 502 | bff | — | 响应缺少 { data, code, codeMsg } 信封 |
| `BFF_NETWORK_ERROR` | `bff.network_error` | 502 | bff | — | BFF 出站网络失败 |
| `BFF_TIMEOUT` | `bff.timeout` | 504 | bff | — | 上游请求超时 |
| `BFF_UNEXPECTED_JSON_RESPONSE` | `bff.unexpected_json_response` | 502 | bff | — | 二进制端点收到 JSON（可能是上游错误页） |
| `BFF_UPSTREAM_FAILED` | `bff.upstream_failed` | 502 | bff | — | 上游返回非 2xx 或业务码非成功 |
