import 'server-only';

import { getServerConfig } from '../server-config';

import { type ILogContext, type ILogger, type LogLevel, redactLogValue, shouldLog } from '@/shared/logger/logger-core';

// 服务标识：单点定义，迁移新项目只改此处（不散落在格式化串里）。
const SERVICE_NAME = 'ssr-app-web';

/**
 * 输出一条服务端结构化日志（单行 JSON 到 stdout/stderr）。
 *
 * @param level - 日志级别。
 * @param message - 日志消息。
 * @param context - 结构化上下文（会脱敏）。
 */
function log(level: LogLevel, message: string, context?: ILogContext): void {
  const config = getServerConfig();
  if (!shouldLog(level, config.logLevel)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    env: config.appEnv,
    requestId: context?.requestId,
    upstreamTraceId: context?.upstreamTraceId,
    traceparent: context?.traceparent,
    routeId: context?.routeId,
    span: context?.span,
    pid: process.pid,
    message,
    context: context?.fields ? redactLogValue(context.fields) : undefined,
  };

  const line = JSON.stringify(entry);
  // logger 是服务端唯一允许触达 console transport 的基础设施层。
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * 服务端结构化 logger；业务代码禁止直接调用 console。
 */
export const serverLogger: ILogger = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
};
