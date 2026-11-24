/**
 * 同构日志核心：日志级别、上下文形状、级别过滤与敏感字段脱敏。
 * 服务端与客户端 logger 共用，本文件不触达任何 transport。
 */

/**
 * 日志级别。
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 结构化日志上下文，禁止直接塞入 token/cookie 等敏感原文。
 */
export interface ILogContext {
  requestId?: string;
  /**
   * 当前 gateway 调用从后端响应头读取的 traceId。
   */
  upstreamTraceId?: string;
  routeId?: string;
  span?: string;
  fields?: Record<string, unknown>;
}

/**
 * 统一 logger 接口，服务端与客户端各自实现。
 */
export interface ILogger {
  debug(message: string, context?: ILogContext): void;
  info(message: string, context?: ILogContext): void;
  warn(message: string, context?: ILogContext): void;
  error(message: string, context?: ILogContext): void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = '[redacted]';
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'secret',
  'email',
  'phone',
]);

/**
 * 判断某级别日志在当前阈值下是否应输出。
 *
 * @param level - 待输出日志的级别。
 * @param threshold - 当前配置的最低级别。
 * @returns 是否应输出。
 */
export function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[threshold];
}

/**
 * 递归脱敏日志上下文中的敏感字段，避免密钥、cookie、PII 落日志。
 *
 * @param value - 任意日志字段值。
 * @returns 脱敏后的副本。
 */
export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactLogValue(item);
    }
    return result;
  }

  return value;
}
