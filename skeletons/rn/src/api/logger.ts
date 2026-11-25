/**
 * 日志级别。
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 错误上报 reporter 接口。具体 SDK 实现（Sentry / Bugsnag / Crashlytics）由业务方注入。
 */
export interface IErrorReporter {
  /** 上报异常。 */
  captureException(error: unknown, context?: Record<string, unknown>): void;
  /** 上报消息。 */
  captureMessage(message: string, level?: 'info' | 'warn' | 'error'): void;
}

/**
 * 业务代码使用的 logger API。
 */
export interface ILogger {
  /** 调试日志，仅 dev 输出。 */
  debug(event: string, payload?: Record<string, unknown>): void;
  /** 信息日志，仅 dev 输出。 */
  info(event: string, payload?: Record<string, unknown>): void;
  /** 警告日志，dev 输出并上报。 */
  warn(event: string, payload?: Record<string, unknown>): void;
  /** 错误日志，dev 输出并上报。 */
  error(event: string, payload?: Record<string, unknown>): void;
}

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
 *
 * @param payload - 原始载荷。
 * @returns 脱敏后的载荷。
 */
function redactSensitiveFields(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (Array.isArray(payload)) return payload.map(redactSensitiveFields);

  if (typeof payload === 'object') {
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      out[key] = SENSITIVE_FIELD_NAMES.has(key.toLowerCase()) ? REDACTED : redactSensitiveFields(value);
    }

    return out;
  }

  return payload;
}

/**
 * 在字符串内做关键模式 redact：用于 HTTP response 预览与 URL 日志。
 *
 * @param text - 原始文本。
 * @returns 脱敏后的文本。
 */
function redactSensitiveString(text: string): string {
  return text
    .replace(
      /"(authorization|token|access_token|refresh_token|password|email|phone|code)"\s*:\s*"[^"]*"/giu,
      '"$1":"***"',
    )
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gu, 'Bearer ***')
    .replace(/([?&](token|email|phone|code|access_token)=)[^&]+/giu, '$1***');
}

/**
 * 截断响应预览并 redact 敏感片段。先 redact 再 slice，避免 token 被截断后漏出。
 *
 * @param text - 原始响应文本。
 * @param maxLen - 最大保留长度。
 * @returns 可安全写入日志的预览。
 */
export function previewResponseText(text: string, maxLen = 300): string {
  return redactSensitiveString(text).slice(0, maxLen);
}

let errorReporter: IErrorReporter | null = null;

/**
 * 注入错误上报 reporter；在 root provider 启动时调用一次。
 *
 * @param reporter - reporter 实例，传 null 表示仅本地日志。
 */
export function setErrorReporter(reporter: IErrorReporter | null): void {
  errorReporter = reporter;
}

/**
 * 内部输出函数：dev 走 console，prod 通过 reporter 上报 warn / error。
 *
 * @param level - 日志级别。
 * @param event - 稳定事件名。
 * @param payload - 事件载荷，写日志前统一脱敏。
 */
function emit(level: LogLevel, event: string, payload?: Record<string, unknown>): void {
  const safe = payload ? (redactSensitiveFields(payload) as Record<string, unknown>) : undefined;

  if (__DEV__) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level}]`, event, safe ?? '');
  }

  if ((level === 'warn' || level === 'error') && errorReporter) {
    try {
      if (level === 'error') {
        const error = safe?.error;

        if (error instanceof Error) {
          errorReporter.captureException(error, { event, ...safe });
        } else {
          errorReporter.captureMessage(event, 'error');
        }
      } else {
        errorReporter.captureMessage(event, 'warn');
      }
    } catch {
      // 静默：reporter 自身异常不能影响业务。
    }
  }
}

/**
 * 统一 logger，业务 / domain / API 代码的唯一日志入口。
 *
 * 敏感字段会被自动 redact；`debug` / `info` 仅 dev 输出，`warn` / `error` 在 prod 也会上报。
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
