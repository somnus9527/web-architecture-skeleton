# 可观测性规则

## 目的

本文件描述 React Native 项目的统一日志、敏感字段 redaction、错误上报与可观测性接入点。

## 统一 Logger

### 模块位置

`src/api/logger.ts` 是唯一允许直接 `console.*` 的模块。其他模块统一通过 logger API。

完整实现见 `docs/rules/rn/templates/logger.md`，含敏感字段 redaction、`__DEV__` gate、错误上报 reporter 注入点与测试。

### 标准 API

```ts
export interface IErrorReporter {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warn' | 'error'): void;
}

export const logger = {
  debug(event: string, payload?: Record<string, unknown>): void { ... },
  info(event: string, payload?: Record<string, unknown>): void { ... },
  warn(event: string, payload?: Record<string, unknown>): void { ... },
  error(event: string, payload?: Record<string, unknown>): void { ... },
};

export function setErrorReporter(reporter: IErrorReporter | null): void { ... }
```

特性：

- `__DEV__` gate：`debug` / `info` 仅 dev 输出；`warn` / `error` prod 也输出（如有 reporter）。
- 自动 redaction：所有 payload 经过 `redactSensitiveFields()`。
- Reporter 钩子：`error()` 调用时若 reporter 已注入，同步派发 `captureException`。

### 业务代码使用

```ts
import { logger } from '@api/logger';

// dev 调试
logger.debug('feature_hydrate', { itemCount: items.length });

// 业务异常但已 fallback
logger.warn('locale_fallback', { requestedLocale, fallbackTo });

// 真实错误
logger.error('external_submit_failed', { error, requestId });
```

## 敏感字段 Redaction

### 默认 redact 字段

logger payload 中以下字段名自动以 `***` 替换：

- `authorization`、`Authorization`
- `token`、`access_token`、`refresh_token`、`session_token`、`bearer_token`
- `password`、`pin`、`code`（短信 / 邮箱验证码）
- `email`、`phone`、`mobile`
- `card`、`cardNumber`、`cvv`
- `ssn`、`idCard`、`passport`

### 响应预览 redaction

`logApiResponse` 在 `text.slice(0, 300)` 之前先做正则 redaction，避免 token 片段被截到日志：

```ts
function previewResponseText(text: string, maxLen = 300): string {
  const redacted = text
    .replace(/"(authorization|token|password|email|phone)"\s*:\s*"[^"]*"/gi, '"$1":"***"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
  return redacted.slice(0, maxLen);
}
```

### URL 中的敏感参数 redaction

URL query 中可能含敏感字段（极少见，但要防）：

```ts
function redactUrl(url: string): string {
  return url.replace(/([?&](token|email|phone|code)=)[^&]+/gi, '$1***');
}
```

### 测试覆盖

`src/test/api/logger.test.ts` 必须覆盖：

- 敏感字段 redaction（payload 与响应预览）。
- dev gate 行为（`__DEV__` true / false）。
- Reporter 注入与未注入路径。
- Reporter 异常不污染 logger（reporter 抛错时 logger 仍正常返回）。

## 禁止业务代码直接 console

业务代码（`src/components/*`、`src/domain/*`、`src/api/*` 除 `logger.ts` 外、`app/*`）禁止：

```ts
console.log(...);
console.warn(...);
console.error(...);
```

由 `src/test/architecture/console-call-boundary.test.ts` 守护，白名单：

- `src/api/logger.ts`（logger 自身实现）
- `src/test/**`（测试文件）

## 错误上报锚点

### Reporter 接口

项目代码不依赖具体 SDK；通过 `IErrorReporter` 接口注入：

```ts
export interface IErrorReporter {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warn' | 'error'): void;
}
```

### 注入位置

`src/components/providers/app-providers.tsx`（或 root layout）中注入：

```tsx
// 当选定具体 SDK 后实现
// setErrorReporter(sentryReporter);

// 默认：暂未引入 SDK
// TODO(observability): wire APM SDK here once selected
setErrorReporter(null);
```

### SDK 选型

具体选型在 `docs/rules/rn/dependencies.md` 中决策。常见选项：

- **Sentry**：功能全、社区活跃、RN 集成成熟。SaaS 免费档有事件量上限，超量需付费。
- **Bugsnag**：商业产品，体验好。
- **Crashlytics**（Firebase）：免费、深度集成 Android。
- **Datadog RUM**：与后端日志统一，但成本高。
- **自建 / 开源（零授权费备选）**：GlitchTip 或自托管 Sentry，均兼容 Sentry SDK 协议，可在自有服务器部署，无 SaaS 事件量费用，仅承担运维成本。仅作为后续确需接入 APM 时的备选；未接入 APM 期间由本地 diagnostics 兜底（见本文件「未接入 APM 期间的兜底」）。

选型完成后：

1. 添加依赖到 `package.json`。
2. 实现 `IErrorReporter` adapter。
3. `app-providers.tsx` 调 `setErrorReporter`。
4. 验证敏感字段 redaction 仍生效。

### 未接入 APM 期间的兜底

未接入 APM SDK 时，**必须落地本地日志持久化 + 用户主动上传**作为问题排查兜底，详见 `docs/rules/rn/diagnostics.md` 与 `docs/rules/rn/templates/diagnostics-collector.md`。

logger 内部已设计为同时支持三条输出路径，互不冲突：

1. dev 模式 `console.*` 输出。
2. 本地日志文件（diagnostics 接管，`warn` / `error` 必写）。
3. APM reporter（如已注入）。

接入 APM SDK 后，本地诊断不下线；继续承担用户主动反馈与 APM 未覆盖事件的角色。

### PII 与上报

- 上报 payload 经过 logger redaction 后才发送。
- 不在 `captureException` 的 context 中加邮箱、密码、token 字段。
- 用户 ID 使用脱敏后的内部 ID，不用邮箱或姓名。

## 指标埋点

### 业务指标

业务指标（primary action、submission success 等）通过 `@domain/analytics-bridge` 派发，不混在 logger 中。

### 性能指标

性能指标（冷启动、API 响应时间、screen render time）：

- 冷启动：`expo-application` + `performance.now()`，在 `app-providers.tsx` mount 时记录。
- API 响应时间：在 `requestJson` 内 `performance.now()` 包裹 fetch。
- 上报到 reporter `captureMessage`，或单独的 metrics endpoint。

## On-call 与诊断

### 日志输出格式

```
[logger] event=feature_hydrate item_count=3
[logger] event=external_submit_failed error_status=500 error_message=*** request_id=req-123
```

- 字段化输出，便于日志收集与查询。
- prod 日志通过 reporter 集中到后台。

### Dev 模式

- `logger.debug` / `logger.info` 直接 `console.log` 输出，便于本地调试。
- `__DEV__ === false` 时这两个 level 不输出。

### 日志级别

| 级别    | 用途                  | dev | prod | 上报 |
| ------- | --------------------- | --- | ---- | ---- |
| `debug` | 内部调试              | ✓   | ✗    | ✗    |
| `info`  | 重要业务节点          | ✓   | ✗    | 可选 |
| `warn`  | 业务异常但已 fallback | ✓   | ✓    | ✓    |
| `error` | 真实错误              | ✓   | ✓    | ✓    |

## 事件名目录

事件名统一 `dot.case`，并集中登记在 `src/api/observability/events.ts` 的 `LOG_EVENTS`：

- 调用侧写 `logger.warn(LOG_EVENTS.API_ERROR, { ... })`，不要直接写字符串字面量；
- `ILogger` 的首参类型是 `LogEventName`，写错或漏登记会在 `pnpm typecheck` 阶段失败；
- `pnpm check:logs`（`scripts/check-logging.mjs`）再校验一次「引用必须在目录里 / 字面量必须登记且符合命名」；
- 名字一旦发布就是上报平台（Sentry / Crashlytics）与看板的契约，改名要同步告警规则。

## 完成检查

- 业务代码 0 处直接 `console.*`。
- 所有 `logger.*` 调用走 `@api/logger` 模块，事件名来自 `LOG_EVENTS`。
- 敏感字段在 logger 与响应预览中 redact。
- ErrorBoundary 与关键 catch 调 `logger.error`。
- 测试覆盖 redaction、dev gate、reporter 注入路径。
- 上报 SDK 选型后通过 `setErrorReporter` 注入。
