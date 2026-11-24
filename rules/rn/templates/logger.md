# Logger 模版

> 上级规则：`docs/rules/rn/observability.md`。

## 适用场景

项目统一日志模块，含敏感字段 redaction、`__DEV__` gate、错误上报 reporter 注入点。

## 完整模版

### 类型与接口

```ts
// src/api/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 错误上报 reporter 接口。具体 SDK 实现（Sentry / Bugsnag / Crashlytics）注入即可。
 */
export interface IErrorReporter {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warn' | 'error'): void;
}

/**
 * 业务代码使用的 logger API。
 */
export interface ILogger {
  debug(event: string, payload?: Record<string, unknown>): void;
  info(event: string, payload?: Record<string, unknown>): void;
  warn(event: string, payload?: Record<string, unknown>): void;
  error(event: string, payload?: Record<string, unknown>): void;
}
```

### Redaction 实现

```ts
/**
 * 默认敏感字段名集合；payload 中匹配字段（不区分大小写）的值被替换为 ***。
 */
const SENSITIVE_FIELD_NAMES = new Set([
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'session_token',
  'bearer_token',
  'password',
  'pin',
  'code',
  'email',
  'phone',
  'mobile',
  'card',
  'cardnumber',
  'cvv',
  'ssn',
  'idcard',
  'passport',
]);

const REDACTED = '***';

/**
 * 递归 redact 对象中的敏感字段。
 */
function redactSensitiveFields(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (Array.isArray(payload)) return payload.map(redactSensitiveFields);

  if (typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redactSensitiveFields(value);
      }
    }
    return out;
  }

  return payload;
}

/**
 * 在字符串内做关键模式 redact：用于 HTTP response 预览。
 *
 * - JSON 中 "authorization":"...", "token":"..." 等字段值
 * - HTTP Authorization header 中的 Bearer token
 * - URL query 中的 token / email / phone / code
 */
function redactSensitiveString(text: string): string {
  return text
    .replace(
      /"(authorization|token|access_token|refresh_token|password|email|phone|code)"\s*:\s*"[^"]*"/gi,
      '"$1":"***"',
    )
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .replace(/([?&](token|email|phone|code|access_token)=)[^&]+/gi, '$1***');
}

/**
 * 截断响应预览并 redact 敏感片段。
 */
export function previewResponseText(text: string, maxLen = 300): string {
  return redactSensitiveString(text).slice(0, maxLen);
}
```

### Logger 实现

```ts
let errorReporter: IErrorReporter | null = null;

/**
 * 注入错误上报 reporter。在 root provider 启动时调用一次。
 *
 * 测试场景可传 null 或 mock reporter。
 */
export function setErrorReporter(reporter: IErrorReporter | null): void {
  errorReporter = reporter;
}

/**
 * 内部输出函数：dev 走 console，prod 通过 reporter 上报 warn / error。
 */
function emit(level: LogLevel, event: string, payload?: Record<string, unknown>): void {
  const safe = payload ? redactSensitiveFields(payload) : undefined;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level}]`, event, safe ?? '');
  }

  // 仅 warn / error 上报（reporter 异常时不影响业务）
  if ((level === 'warn' || level === 'error') && errorReporter) {
    try {
      if (level === 'error') {
        const error = safe && (safe as Record<string, unknown>).error;
        if (error instanceof Error) {
          errorReporter.captureException(error, { event, ...(safe as Record<string, unknown>) });
        } else {
          errorReporter.captureMessage(event, 'error');
        }
      } else {
        errorReporter.captureMessage(event, 'warn');
      }
    } catch {
      // 静默：reporter 不能影响业务
    }
  }
}

/**
 * 统一 logger，业务代码唯一入口。
 *
 * 敏感字段会被自动 redact。`debug` / `info` 仅 dev 输出，
 * `warn` / `error` prod 也会上报到注入的 reporter。
 */
export const logger: ILogger = {
  debug(event, payload) {
    emit('debug', event, payload);
  },
  info(event, payload) {
    emit('info', event, payload);
  },
  warn(event, payload) {
    emit('warn', event, payload);
  },
  error(event, payload) {
    emit('error', event, payload);
  },
};
```

## 在 root provider 注入 reporter

```tsx
// src/components/providers/app-providers.tsx
import { useEffect } from 'react';
import { setErrorReporter } from '@api/logger';

// 当具体 APM SDK 选定后，实现 adapter 并注入：
// import { sentryReporter, initSentry } from '@/observability/sentry-reporter';

function ObservabilityBootstrap() {
  useEffect(() => {
    // TODO(observability): wire APM SDK here once selected.
    // initSentry();
    // setErrorReporter(sentryReporter);
    setErrorReporter(null);
  }, []);
  return null;
}

export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... 其他 Provider ... */}
      <ObservabilityBootstrap />
      {children}
    </QueryClientProvider>
  );
}
```

## 在业务代码使用

```ts
import { logger } from '@api/logger';

// dev 调试节点
logger.debug('feature_hydrate', { itemCount: items.length });

// 业务异常但已 fallback
logger.warn('locale_fallback', { requestedLocale, fallbackTo });

// 真实错误
try {
  await submitOrder(payload);
} catch (error) {
  logger.error('feature_submit_failed', { error, requestId });
  pushToast({ title: t('feature.submit.failed'), variant: 'error' });
}
```

## 在 API client 使用

```ts
// src/api/client.ts
import { logger, previewResponseText } from '@api/logger';

logger.debug('api_request', { method, url });
const text = await response.text();
logger.debug('api_response', {
  method,
  url,
  status: response.status,
  preview: previewResponseText(text),
});
```

## 注意点

- **业务代码唯一入口**：`logger` 是唯一允许出现在业务 / domain / API 代码中的日志调用方式。`console.*` 仅在 `logger.ts` 自身允许。
- **Redaction 默认开**：所有 payload 都过 `redactSensitiveFields`；新增敏感字段直接加入 `SENSITIVE_FIELD_NAMES`。
- **响应预览必须用 `previewResponseText`**：先 redact 再 slice，避免 token 被截到日志。
- **Reporter 异常隔离**：reporter 自身报错不能让业务挂掉。
- **`__DEV__` gate**：debug / info 不进 prod；warn / error 进 prod 并通过 reporter 上报。
- **error payload 含 Error 对象时**：reporter 通过 `captureException` 上报，否则 `captureMessage`。

## 测试

```ts
// src/test/api/logger.test.ts
import { logger, previewResponseText, setErrorReporter, type IErrorReporter } from '@api/logger';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    setErrorReporter(null);
  });

  it('redacts sensitive fields in payload', () => {
    logger.warn('test_event', { token: 'abc123', email: 'user@test.com', requestId: 'req-1' });
    expect(consoleWarnSpy).toHaveBeenCalledWith('[warn]', 'test_event', {
      token: '***',
      email: '***',
      requestId: 'req-1',
    });
  });

  it('redacts nested sensitive fields', () => {
    logger.warn('test_event', { user: { email: 'u@test', name: 'Alice' } });
    expect(consoleWarnSpy).toHaveBeenCalledWith('[warn]', 'test_event', {
      user: { email: '***', name: 'Alice' },
    });
  });

  it('previewResponseText redacts JSON token field', () => {
    const text = '{"token":"abc123","name":"Alice"}';
    expect(previewResponseText(text)).toBe('{"token":"***","name":"Alice"}');
  });

  it('previewResponseText redacts Bearer token', () => {
    expect(previewResponseText('Authorization: Bearer abc.def.ghi')).toContain('Bearer ***');
  });

  it('previewResponseText slices after redact', () => {
    const text = '{"a":"' + 'x'.repeat(500) + '"}';
    expect(previewResponseText(text, 100).length).toBe(100);
  });

  it('forwards error to reporter on logger.error', () => {
    const reporter: IErrorReporter = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    };
    setErrorReporter(reporter);

    const err = new Error('boom');
    logger.error('failed', { error: err });

    expect(reporter.captureException).toHaveBeenCalledWith(err, expect.objectContaining({ event: 'failed' }));
  });

  it('does not throw when reporter itself throws', () => {
    const reporter: IErrorReporter = {
      captureException: () => {
        throw new Error('reporter boom');
      },
      captureMessage: jest.fn(),
    };
    setErrorReporter(reporter);

    expect(() => logger.error('failed', { error: new Error('boom') })).not.toThrow();
  });
});
```
