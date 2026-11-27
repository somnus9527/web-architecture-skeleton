'use client';

import { type LogEventName } from '@/shared/observability/events';

import { type ILogContext, type ILogger, type LogLevel, redactLogValue, shouldLog } from './logger-core';

const clientThreshold: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * 输出一条客户端日志。生产环境全部 no-op（防止敏感信息落浏览器控制台）。
 *
 * @param level - 日志级别。
 * @param message - 日志消息。
 * @param context - 结构化上下文（会脱敏）。
 */
function log(level: LogLevel, message: LogEventName, context?: ILogContext): void {
  if (isProduction || !shouldLog(level, clientThreshold)) {
    return;
  }

  const payload = context ? { message, context: redactLogValue(context) } : { message };
  // 客户端 logger 是浏览器侧唯一允许触达 console 的基础设施层。

  console[level === 'debug' ? 'log' : level](payload);
}

/**
 * 浏览器侧结构化 logger；业务代码禁止直接调用 console。
 */
export const clientLogger: ILogger<LogEventName> = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
};
