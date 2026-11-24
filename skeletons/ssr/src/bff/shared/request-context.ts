import 'server-only';

import { randomUUID } from 'node:crypto';

/**
 * 单次请求的追踪上下文，串联 RSC / service / gateway / 上游调用。
 */
export interface IRequestContext {
  /**
   * 全链路请求标识，缺失时服务端生成。
   */
  requestId: string;
  /**
   * Java TLog 链路 ID；由后端响应头回填，供浏览器侧排障展示。
   */
  tlogTraceId?: string;
  /**
   * 当前请求解析出的 locale，用于出站 `Accept-Language` 与日志。
   */
  locale: string;
  /**
   * W3C traceparent，存在时透传给上游以对齐分布式追踪。
   */
  traceparent?: string;
}

const MAX_TRACE_ID_LENGTH = 64;
const SAFE_TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

/**
 * 从请求头与已解析 locale 构造请求上下文。
 *
 * @param requestHeaders - 当前请求头。
 * @param locale - 调用方（通常经 `getLocale()`）解析出的 locale。
 * @returns 请求上下文。
 */
export function createRequestContext(requestHeaders: Headers, locale: string): IRequestContext {
  const requestId = requestHeaders.get('x-request-id') ?? requestHeaders.get('x-trace-id') ?? randomUUID();
  const tlogTraceId = normalizeTraceId(requestHeaders.get('tlogTraceId'));
  const traceparent = requestHeaders.get('traceparent') ?? undefined;

  return { requestId, tlogTraceId, locale, traceparent };
}

/**
 * 保存后端返回的 TLog traceId，避免把任意响应头值原样透给浏览器。
 *
 * @param context - 当前请求上下文。
 * @param value - 后端响应头中的 traceId。
 * @returns 校验通过的当前上游 traceId；无效或缺失时返回 undefined。
 */
export function rememberTlogTraceId(context: IRequestContext, value: string | null): string | undefined {
  const traceId = normalizeTraceId(value);
  if (traceId) {
    context.tlogTraceId = traceId;
  }

  return traceId;
}

/**
 * 只接受长度受控且不含换行等危险字符的 traceId。
 *
 * @param value - 待校验的 traceId。
 * @returns 可安全透出的 traceId。
 */
function normalizeTraceId(value: string | null): string | undefined {
  const traceId = value?.trim();
  if (!traceId || traceId.length > MAX_TRACE_ID_LENGTH || !SAFE_TRACE_ID_PATTERN.test(traceId)) {
    return undefined;
  }
  return traceId;
}
