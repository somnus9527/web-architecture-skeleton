import 'server-only';

import { rememberTlogTraceId, type IRequestContext } from './request-context';

import { redactLogValue } from '@/shared/logger/logger-core';

import { serverLogger } from '@/bff/shared/logger/server-logger';
import { getServerConfig } from '@/bff/shared/server-config';
import {
  BffAuthError,
  createSessionExpiredAuthError,
  isSessionExpiredBusinessCode,
  type IBackendAuthHeaders,
} from '@/bff/transform/session-auth-transform';

const SUCCESS_CODE = '200';
const DEFAULT_TIMEOUT_MS = 10_000;
const TLOG_TRACE_ID_HEADER = 'tlogTraceId';

export type HttpMethod = 'GET' | 'POST';

export type HttpErrorKind = 'http' | 'business' | 'contract' | 'json_parse' | 'timeout' | 'network' | 'aborted';

export type HttpDataPolicy = 'required' | 'allow-null';

/**
 * BFF 统一请求配置。调用方必须来自 gateway，并显式传入 endpoint 元信息用于日志与契约追踪。
 */
export interface IHttpClientRequest<TBody extends object | undefined> {
  endpointId: string;
  operationId: string;
  method: HttpMethod;
  path: string;
  context: IRequestContext;
  body?: TBody;
  cache?: RequestCache;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
  timeoutMs?: number;
  dataPolicy?: HttpDataPolicy;
  businessErrorStatus?: number;
  authHeaders?: IBackendAuthHeaders;
  extraHeaders?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

/**
 * 二进制请求只允许 gateway 使用 JSON POST，响应元数据可由 Route Handler 原样转发。
 */
export interface IHttpClientBinaryRequest<TBody extends object> extends Omit<
  IHttpClientRequest<TBody>,
  'businessErrorStatus' | 'dataPolicy' | 'method'
> {
  method: 'POST';
  body: TBody;
}

/**
 * 二进制响应仅暴露转发所需的文件内容与安全响应头。
 */
export interface IHttpClientBinaryResponse {
  body: ArrayBuffer;
  contentType: string | null;
  contentLength: string | null;
  contentDisposition: string | null;
}

/**
 * 后端统一响应信封。请求底座只消费该结构，成功时只把 `data` 返回给 gateway。
 */
interface IBackendResponseEnvelope<TData> {
  data: TData | null;
  code: string;
  codeMsg: string | null;
}

/**
 * BFF 出站请求归一化错误。错误对象只携带排障必要字段，避免泄漏 token、cookie、密码或完整响应体。
 */
export class BffHttpClientError extends Error {
  readonly kind: HttpErrorKind;
  readonly status: number;
  readonly code: string;
  readonly codeMsg: string;
  readonly endpointId: string;
  readonly operationId: string;
  readonly requestId: string;

  constructor(init: {
    kind: HttpErrorKind;
    status: number;
    code: string;
    codeMsg: string;
    endpointId: string;
    operationId: string;
    requestId: string;
  }) {
    super(init.codeMsg);
    this.name = 'BffHttpClientError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.codeMsg = init.codeMsg;
    this.endpointId = init.endpointId;
    this.operationId = init.operationId;
    this.requestId = init.requestId;
  }
}

/**
 * BFF gateway 统一请求后端或 Prism，并把 HTTP、JSON、业务信封和超时错误归一化。
 *
 * @param request - gateway 提供的 endpoint 配置、请求上下文与可选请求体。
 * @returns 后端统一信封中的 `data`。
 */
export async function requestBackend<TData, TBody extends object | undefined = undefined>(
  request: IHttpClientRequest<TBody>,
): Promise<TData> {
  validateGatewayPath(request.path, request);

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dataPolicy = request.dataPolicy ?? 'required';
  const startedAt = Date.now();
  const abortState = createAbortState(request.signal, timeoutMs);
  const url = `${resolveBaseUrl()}${request.path}`;
  let upstreamTraceId: string | undefined;

  serverLogger.info('bff upstream request started', {
    requestId: request.context.requestId,
    routeId: `gateway:${request.endpointId}`,
    span: 'gateway',
    fields: {
      endpointId: request.endpointId,
      operationId: request.operationId,
      method: request.method,
      path: request.path,
      requestBody: summarizePayload(request.body),
      actorType: request.authHeaders ? 'user' : 'guest',
      hasAuth: Boolean(request.authHeaders),
      traceparent: request.context.traceparent,
    },
  });

  try {
    const response = await fetch(url, {
      method: request.method,
      cache: request.cache ?? 'no-store',
      next: request.next,
      headers: buildHeaders(request),
      body: serializeRequestBody(request.body),
      signal: abortState.signal,
    });
    upstreamTraceId = rememberTlogTraceId(request.context, response.headers.get(TLOG_TRACE_ID_HEADER));

    const payload = await parseResponseEnvelope<TData, TBody>(response, request);
    if (payload.code !== SUCCESS_CODE) {
      if (isSessionExpiredBusinessCode(payload.code)) {
        throw createSessionExpiredAuthError(payload.codeMsg);
      }

      throw createHttpClientError(request, {
        kind: 'business',
        status: request.businessErrorStatus ?? 502,
        code: payload.code,
        codeMsg: payload.codeMsg ?? 'Upstream business error.',
      });
    }

    if (payload.data === null && dataPolicy === 'required') {
      throw createHttpClientError(request, {
        kind: 'contract',
        status: 502,
        code: 'empty_data',
        codeMsg: 'Upstream response data is empty.',
      });
    }

    logUpstream('info', request, {
      status: response.status,
      code: payload.code,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      upstreamTraceId,
      responseBody: summarizePayload(payload.data),
    });

    serverLogger.debug('bff upstream payload', {
      requestId: request.context.requestId,
      routeId: `gateway:${request.endpointId}`,
      span: 'gateway',
      fields: {
        endpointId: request.endpointId,
        operationId: request.operationId,
        requestBody: summarizePayload(request.body),
        responseBody: summarizePayload(payload.data),
      },
    });

    return payload.data as TData;
  } catch (error) {
    if (error instanceof BffAuthError) {
      logUpstream('warn', request, {
        status: error.status,
        code: error.code,
        durationMs: Date.now() - startedAt,
        timeoutMs,
        errorKind: 'business',
        upstreamTraceId,
      });
      throw error;
    }

    const normalizedError = normalizeRequestError(error, request, abortState.timeoutTriggered);
    logUpstream(normalizedError.kind === 'business' ? 'warn' : 'error', request, {
      status: normalizedError.status,
      code: normalizedError.code,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      errorKind: normalizedError.kind,
      upstreamTraceId,
    });
    throw normalizedError;
  } finally {
    abortState.dispose();
  }
}

/**
 * BFF gateway 使用 JSON POST 下载二进制内容，并把文件响应头交给 Route Handler 转发。
 *
 * @param request - gateway 提供的 endpoint 配置、请求上下文与 JSON 请求体。
 * @returns 文件字节及后端返回的内容类型、长度和下载文件名。
 */
export async function requestBackendBinary<TBody extends object>(
  request: IHttpClientBinaryRequest<TBody>,
): Promise<IHttpClientBinaryResponse> {
  validateGatewayPath(request.path, request);

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const abortState = createAbortState(request.signal, timeoutMs);
  const url = `${resolveBaseUrl()}${request.path}`;
  let upstreamTraceId: string | undefined;

  serverLogger.info('bff upstream request started', {
    requestId: request.context.requestId,
    routeId: `gateway:${request.endpointId}`,
    span: 'gateway',
    fields: {
      endpointId: request.endpointId,
      operationId: request.operationId,
      method: request.method,
      path: request.path,
      requestBody: summarizePayload(request.body),
      actorType: request.authHeaders ? 'user' : 'guest',
      hasAuth: Boolean(request.authHeaders),
      traceparent: request.context.traceparent,
    },
  });

  try {
    const response = await fetch(url, {
      method: request.method,
      cache: request.cache ?? 'no-store',
      headers: buildHeaders(request),
      body: JSON.stringify(request.body),
      signal: abortState.signal,
    });
    upstreamTraceId = rememberTlogTraceId(request.context, response.headers.get(TLOG_TRACE_ID_HEADER));

    if (isJsonResponse(response)) {
      const payload = await parseJsonResponseEnvelope<unknown, TBody>(response, request);
      if (payload.code !== SUCCESS_CODE) {
        if (isSessionExpiredBusinessCode(payload.code)) {
          throw createSessionExpiredAuthError(payload.codeMsg);
        }

        throw createHttpClientError(request, {
          kind: 'business',
          status: 502,
          code: payload.code,
          codeMsg: payload.codeMsg ?? 'Upstream business error.',
        });
      }

      if (!response.ok) {
        throw createHttpClientError(request, {
          kind: 'http',
          status: response.status,
          code: 'upstream_error',
          codeMsg: `Upstream returned ${response.status}.`,
        });
      }

      throw createHttpClientError(request, {
        kind: 'contract',
        status: 502,
        code: 'unexpected_json_response',
        codeMsg: 'Upstream returned JSON instead of binary content.',
      });
    }

    if (!response.ok) {
      await releaseResponseBody(response);
      throw createHttpClientError(request, {
        kind: 'http',
        status: response.status,
        code: 'upstream_error',
        codeMsg: `Upstream returned ${response.status}.`,
      });
    }

    const result: IHttpClientBinaryResponse = {
      body: await response.arrayBuffer(),
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      contentDisposition: response.headers.get('content-disposition'),
    };

    logUpstream('info', request, {
      status: response.status,
      code: 'binary',
      durationMs: Date.now() - startedAt,
      timeoutMs,
      upstreamTraceId,
    });

    return result;
  } catch (error) {
    if (error instanceof BffAuthError) {
      logUpstream('warn', request, {
        status: error.status,
        code: error.code,
        durationMs: Date.now() - startedAt,
        timeoutMs,
        errorKind: 'business',
        upstreamTraceId,
      });
      throw error;
    }

    const normalizedError = normalizeRequestError(error, request, abortState.timeoutTriggered);
    logUpstream(normalizedError.kind === 'business' ? 'warn' : 'error', request, {
      status: normalizedError.status,
      code: normalizedError.code,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      errorKind: normalizedError.kind,
      upstreamTraceId,
    });
    throw normalizedError;
  } finally {
    abortState.dispose();
  }
}

/**
 * 校验 gateway 传入的 path，防止完整 URL 绕过 server-config 的环境切换与 SSRF 边界。
 */
function validateGatewayPath<TBody extends object | undefined>(path: string, request: IHttpClientRequest<TBody>): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw createHttpClientError(request, {
      kind: 'contract',
      status: 500,
      code: 'invalid_gateway_path',
      codeMsg: 'Gateway path must start with a single slash.',
    });
  }
}

/**
 * 根据运行环境选择真实后端或 Prism mock base URL。
 */
function resolveBaseUrl(): string {
  const config = getServerConfig();
  if (config.appEnv === 'mock') {
    const prismMockBaseUrl = config.prismMockBaseUrl;
    if (!prismMockBaseUrl) {
      throw new Error('Missing mock base URL in mock environment.');
    }

    return prismMockBaseUrl;
  }

  if (!config.backendApiBaseUrl) {
    throw new Error('Remote gateway base URL is not configured.');
  }

  return config.backendApiBaseUrl;
}

/**
 * 构造后端请求头。浏览器 cookie 不会透传，鉴权只能来自 BFF 已转换出的服务端 header。
 */
function buildHeaders<TBody extends object | undefined>(request: IHttpClientRequest<TBody>): Record<string, string> {
  const hasFormDataBody = isFormDataBody(request.body);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': request.context.locale,
    'X-Locale': request.context.locale,
    'X-Request-Id': request.context.requestId,
    'X-Trace-Id': request.context.requestId,
  };

  if (request.body !== undefined && !hasFormDataBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (request.context.traceparent) {
    headers.traceparent = request.context.traceparent;
  }

  if (request.authHeaders) {
    headers.authorization = request.authHeaders.authorization;
    headers['X-User-Type'] = request.authHeaders.xUserType;
  }

  if (request.extraHeaders) {
    for (const [key, value] of Object.entries(request.extraHeaders)) {
      if (value !== undefined && !(hasFormDataBody && key.toLowerCase() === 'content-type')) {
        headers[key] = value;
      }
    }
  }

  return headers;
}

/**
 * JSON 请求保持原有序列化行为，FormData 则交给运行时生成 multipart boundary。
 */
function serializeRequestBody<TBody extends object | undefined>(body: TBody): BodyInit | undefined {
  if (body === undefined || isFormDataBody(body)) {
    return body;
  }

  return JSON.stringify(body);
}

/**
 * 判断请求体是否为当前服务端运行时的 FormData。
 */
function isFormDataBody(body: object | undefined): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/**
 * JSON Content-Type 表示后端返回了业务信封，而不是文件内容。
 */
function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase();
  return Boolean(contentType?.includes('application/json') || contentType?.includes('+json'));
}

/**
 * 创建请求级 AbortController，同时兼容调用方主动取消和内部 timeout。
 */
function createAbortState(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  timeoutTriggered: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let isTimeoutTriggered = false;

  const timeoutId = setTimeout(() => {
    isTimeoutTriggered = true;
    controller.abort();
  }, timeoutMs);

  const abortByCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortByCaller, { once: true });
    }
  }

  return {
    signal: controller.signal,
    timeoutTriggered: () => isTimeoutTriggered,
    dispose: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortByCaller);
    },
  };
}

/**
 * 解析统一响应信封，并把 HTTP、JSON 与信封形状错误转换为统一错误。
 */
async function parseResponseEnvelope<TData, TBody extends object | undefined>(
  response: Response,
  request: IHttpClientRequest<TBody>,
): Promise<IBackendResponseEnvelope<TData>> {
  if (!response.ok) {
    throw createHttpClientError(request, {
      kind: 'http',
      status: response.status,
      code: 'upstream_error',
      codeMsg: `Upstream returned ${response.status}.`,
    });
  }

  return parseJsonResponseEnvelope<TData, TBody>(response, request);
}

/**
 * 读取并校验 JSON 业务信封，允许二进制请求在 HTTP 错误时优先识别业务错误。
 */
async function parseJsonResponseEnvelope<TData, TBody extends object | undefined>(
  response: Response,
  request: IHttpClientRequest<TBody>,
): Promise<IBackendResponseEnvelope<TData>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw createHttpClientError(request, {
      kind: 'json_parse',
      status: 502,
      code: 'json_parse_error',
      codeMsg: 'Upstream response JSON parse failed.',
    });
  }

  if (!isBackendResponseEnvelope(payload)) {
    throw createHttpClientError(request, {
      kind: 'contract',
      status: 502,
      code: 'malformed_wrapper',
      codeMsg: 'Upstream response wrapper is malformed.',
    });
  }

  return payload as IBackendResponseEnvelope<TData>;
}

/**
 * 非 JSON HTTP 错误在抛出前释放响应流，取消失败时再尝试完整消费。
 */
async function releaseResponseBody(response: Response): Promise<void> {
  if (!response.body) {
    return;
  }

  try {
    await response.body.cancel();
  } catch {
    try {
      await response.arrayBuffer();
    } catch {
      // 释放失败不能覆盖原始 HTTP 错误。
    }
  }
}

/**
 * 运行时校验后端统一响应信封的基础形状。
 */
function isBackendResponseEnvelope(value: unknown): value is IBackendResponseEnvelope<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const wrapper = value as Record<string, unknown>;
  return (
    'data' in wrapper &&
    typeof wrapper.code === 'string' &&
    'codeMsg' in wrapper &&
    (wrapper.codeMsg === null || typeof wrapper.codeMsg === 'string')
  );
}

/**
 * 将 fetch 抛出的网络、超时和调用方取消错误归一化。
 */
function normalizeRequestError<TBody extends object | undefined>(
  error: unknown,
  request: IHttpClientRequest<TBody>,
  timeoutTriggered: () => boolean,
): BffHttpClientError {
  if (error instanceof BffHttpClientError) {
    return error;
  }

  if (isAbortError(error)) {
    if (timeoutTriggered()) {
      return createHttpClientError(request, {
        kind: 'timeout',
        status: 504,
        code: 'timeout',
        codeMsg: 'Upstream request timed out.',
      });
    }

    return createHttpClientError(request, {
      kind: 'aborted',
      status: 499,
      code: 'aborted',
      codeMsg: 'Upstream request was aborted.',
    });
  }

  return createHttpClientError(request, {
    kind: 'network',
    status: 502,
    code: 'network_error',
    codeMsg: 'Upstream network request failed.',
  });
}

/**
 * 兼容 Node fetch 与浏览器标准 AbortError 的不同异常形状。
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * 创建统一错误对象，避免在各分支重复填充 endpoint 和 request id。
 */
function createHttpClientError<TBody extends object | undefined>(
  request: IHttpClientRequest<TBody>,
  init: {
    kind: HttpErrorKind;
    status: number;
    code: string;
    codeMsg: string;
  },
): BffHttpClientError {
  return new BffHttpClientError({
    ...init,
    endpointId: request.endpointId,
    operationId: request.operationId,
    requestId: request.context.requestId,
  });
}

/**
 * 输出脱敏后的上游调用摘要。默认不记录 body、authorization、cookie 或完整响应体。
 */
/**
 * 把请求/响应 payload 归一成可安全写入日志的摘要；完整 payload 只在 debug 级别出现。
 *
 * @param value - 原始 payload。
 * @returns 脱敏且截断的摘要。
 */
function summarizePayload(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  const redacted = redactLogValue(value);
  try {
    const text = JSON.stringify(redacted);
    return text.length > 2000 ? `${text.slice(0, 2000)}...` : redacted;
  } catch {
    return '[unserializable]';
  }
}

function logUpstream<TBody extends object | undefined>(
  level: 'info' | 'warn' | 'error',
  request: IHttpClientRequest<TBody>,
  fields: {
    status: number;
    code: string;
    durationMs: number;
    timeoutMs: number;
    errorKind?: HttpErrorKind;
    /**
     * 当前后端调用响应头返回的 TLog traceId。
     */
    upstreamTraceId?: string;
    /**
     * 脱敏后的响应摘要；完整 payload 只在 debug 日志出现。
     */
    responseBody?: unknown;
  },
): void {
  serverLogger[level]('bff upstream request completed', {
    requestId: request.context.requestId,
    upstreamTraceId: fields.upstreamTraceId,
    routeId: `gateway:${request.endpointId}`,
    span: 'gateway',
    fields: {
      endpointId: request.endpointId,
      operationId: request.operationId,
      method: request.method,
      path: request.path,
      status: fields.status,
      code: fields.code,
      durationMs: fields.durationMs,
      timeoutMs: fields.timeoutMs,
      errorKind: fields.errorKind,
      actorType: request.authHeaders ? 'user' : 'guest',
      hasAuth: Boolean(request.authHeaders),
      hasTraceparent: Boolean(request.context.traceparent),
      traceparent: request.context.traceparent,
      requestBody: summarizePayload(request.body),
      responseBody: fields.responseBody,
    },
  });
}
