import type { LogEventName } from '@/shared/observability/events';

/**
 * 前端日志事件级别。`performance` / `marketing` 是生产允许保留的白名单类别。
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 生产允许保留的非业务日志类别。
 */
export type RetainedLogCategory = 'performance' | 'marketing';

/**
 * 运行时日志事件。
 */
interface ILogEvent {
  /**
   * 日志级别。
   */
  level: LogLevel;
  /**
   * 稳定事件名，避免上报侧依赖用户可见文案。
   */
  event: string;
  /**
   * 附加上下文，通常是错误对象或业务 id。
   */
  payload?: unknown;
}

/**
 * 骨架阶段的日志缓冲区，后续可替换为真实 observability reporter。
 */
const logBuffer: ILogEvent[] = [];
const isProduction = import.meta.env.PROD;

/**
 * 写入日志；开发环境输出 console，生产环境只保留性能/营销白名单。
 *
 * @param level - 事件级别。
 * @param event - 已登记的稳定日志事件名。
 * @param payload - 可选上下文数据。
 */
function appendLog(level: LogLevel, event: LogEventName, payload?: unknown): void {
  logBuffer.push({ level, event, payload });

  if (isProduction) {
    return;
  }

  // eslint-disable-next-line no-console -- logger 是唯一允许触达 console 的基础设施层
  console[level === 'debug' ? 'log' : level]({ level, event, payload });
}

/**
 * 记录性能事件；生产构建允许保留，走 Performance API，不落 console。
 *
 * @param event - 稳定性能事件名。
 * @param detail - 可选的性能上下文。
 */
function performanceEvent(event: string, detail?: Record<string, unknown>): void {
  if (typeof performance === 'undefined') {
    return;
  }

  performance.mark(event, detail ? { detail } : undefined);
}

/**
 * 记录广告/招聘等非业务营销事件；生产允许保留，但不得包含用户敏感信息。
 *
 * @param event - 稳定营销事件名。
 * @param payload - 非敏感营销上下文。
 */
function marketing(event: string, payload?: Record<string, unknown>): void {
  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  dataLayer?.push({ event, ...payload });
}

/**
 * 应用级 logger，隐藏具体上报实现，避免调用方依赖 console 或三方 SDK。
 *
 * 生产构建由 Vite `esbuild.drop` 删除 console；业务日志在 production 只进内存，不落浏览器控制台。
 */
export const logger = {
  debug: (event: LogEventName, payload?: unknown) => appendLog('debug', event, payload),
  info: (event: LogEventName, payload?: unknown) => appendLog('info', event, payload),
  warn: (event: LogEventName, payload?: unknown) => appendLog('warn', event, payload),
  error: (event: LogEventName, payload?: unknown) => appendLog('error', event, payload),
  performance: performanceEvent,
  marketing,
};
