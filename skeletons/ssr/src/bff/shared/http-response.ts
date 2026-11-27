import 'server-only';

import type { IRequestContext } from './request-context';

import { SUCCESS_CODE } from '@/shared/errors/codes';

/**
 * 把后端 TLog traceId 透出到浏览器响应头，缺失时不下发空头。
 *
 * @param context - 请求上下文。
 * @returns 需要追加的响应头。
 */
function tlogTraceHeaders(context: IRequestContext): Record<string, string> {
  return context.tlogTraceId ? { 'X-TLog-Trace-Id': context.tlogTraceId } : {};
}

/**
 * BFF 统一 JSON 响应信封。成功 `code='200'`、`codeMsg=null`；失败 `data=null`。
 */
export interface IBffJsonResponse<T> {
  data: T | null;
  code: string;
  codeMsg: string | null;
  requestId: string;
}

/**
 * 成功响应可选项。
 */
export interface IBffSuccessInit {
  /**
   * 覆盖默认 `Cache-Control`。公开可缓存端点显式传入（如 `public, s-maxage=60`）。
   * 不传时默认 `no-store`（安全默认，避免用户态数据被 CDN 缓存）。
   */
  cacheControl?: string;
  /**
   * HTTP 状态码，默认 200。
   */
  status?: number;
}

/**
 * 构造成功响应。默认 `Cache-Control: no-store`；公开只读端点须显式 opt-in 缓存。
 *
 * @param data - 业务负载（已是 view model，非 raw DTO）。
 * @param context - 请求上下文，提供 requestId。
 * @param init - 可选缓存/状态覆盖。
 * @returns JSON Response。
 */
export function createBffSuccessResponse<T>(data: T, context: IRequestContext, init?: IBffSuccessInit): Response {
  const body: IBffJsonResponse<T> = { data, code: SUCCESS_CODE, codeMsg: null, requestId: context.requestId };

  return Response.json(body, {
    status: init?.status ?? 200,
    headers: {
      'Cache-Control': init?.cacheControl ?? 'no-store',
      'X-Request-Id': context.requestId,
      ...tlogTraceHeaders(context),
    },
  });
}

/**
 * 构造错误响应，始终 `no-store`，不携带堆栈或敏感信息。
 *
 * @param code - 归一后的业务错误码。
 * @param codeMsg - 面向前端的错误提示。
 * @param context - 请求上下文，提供 requestId。
 * @param status - HTTP 状态码。
 * @returns JSON Response。
 */
export function createBffErrorResponse(
  code: string,
  codeMsg: string,
  context: IRequestContext,
  status: number,
): Response {
  const body: IBffJsonResponse<null> = { data: null, code, codeMsg, requestId: context.requestId };

  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-Id': context.requestId,
      ...tlogTraceHeaders(context),
    },
  });
}
