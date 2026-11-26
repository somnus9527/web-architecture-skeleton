import 'server-only';

import { randomUUID } from 'node:crypto';

import { isValidTraceparent, normalizeRequestId, normalizeTracestate } from '@/shared/trace/trace-context';

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
  /**
   * W3C tracestate，仅在 traceparent 合法时随之下发。
   */
  tracestate?: string;
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
  // requestId / traceparent 由 proxy 注入并已校验；这里再校验一次，避免绕过 proxy 的调用点（如测试）拿到脏值。
  const requestId = normalizeRequestId(requestHeaders.get('x-request-id')) ?? randomUUID();
  const inboundTraceparent = requestHeaders.get('traceparent');
  const traceparent = isValidTraceparent(inboundTraceparent) ? inboundTraceparent.trim() : undefined;
  const tracestate = traceparent ? normalizeTracestate(requestHeaders.get('tracestate')) : undefined;

  // tlogTraceId 只允许来自后端响应头（rememberTlogTraceId），入站值一律忽略。
  return tracestate ? { requestId, locale, traceparent, tracestate } : { requestId, locale, traceparent };
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
