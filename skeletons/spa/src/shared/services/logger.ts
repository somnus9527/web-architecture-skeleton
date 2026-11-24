/**
 * 前端日志事件级别。
 */
export type LogLevel = 'warn' | 'error';

/**
 * 运行时日志事件。
 */
interface ILogEvent {
  /**
   * 日志级别，用于后续接入 Sentry 或浏览器日志上报。
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

/**
 * 写入内存日志缓冲区，避免在业务代码中直接使用 console。
 *
 * @param level - 事件级别。
 * @param event - 稳定日志事件名。
 * @param payload - 可选上下文数据。
 */
function appendLog(level: LogLevel, event: string, payload?: unknown): void {
  logBuffer.push({ level, event, payload });
}

/**
 * 记录可恢复异常或降级路径。
 *
 * @param event - 稳定日志事件名。
 * @param payload - 可选上下文数据。
 */
function warn(event: string, payload?: unknown): void {
  appendLog('warn', event, payload);
}

/**
 * 记录会影响页面或用户动作的错误。
 *
 * @param event - 稳定日志事件名。
 * @param payload - 可选上下文数据。
 */
function error(event: string, payload?: unknown): void {
  appendLog('error', event, payload);
}

/**
 * 应用级 logger，隐藏具体上报实现，避免调用方依赖 console 或三方 SDK。
 */
export const logger = {
  warn,
  error,
};
