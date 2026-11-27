import { readApiConfig } from '@api/config';
import { ApiError } from '@api/errors';
import { logger, previewResponseText } from '@api/logger';
import { LOG_EVENTS } from '@api/observability/events';

/**
 * 支持的 HTTP 方法。
 */
export type ApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST';

/**
 * fetch 初始化参数。
 */
export interface IApiFetchInit {
  /** 请求体，JSON 字符串。 */
  body?: string;
  /** 请求头。 */
  headers: Record<string, string>;
  /** HTTP 方法。 */
  method: ApiMethod;
}

/**
 * fetch 响应的最小结构，便于测试注入。
 */
export interface IApiFetchResponse {
  /** 是否 2xx。 */
  ok: boolean;
  /** HTTP 状态码。 */
  status: number;
  /** 读取响应文本。 */
  text: () => Promise<string>;
}

/**
 * 可注入的 fetch 实现。
 */
export type ApiFetch = (url: string, init: IApiFetchInit) => Promise<IApiFetchResponse>;

/**
 * 通用请求选项。
 */
export interface IApiRequestOptions {
  /** 调用方显式传入的 auth token；client 不读 storage。 */
  authToken?: string;
  /** 覆盖 base URL，测试场景使用。 */
  baseUrl?: string;
  /** 注入 fetch 实现，测试场景使用。 */
  fetchImpl?: ApiFetch;
  /** HTTP 方法。 */
  method: ApiMethod;
}

/**
 * getJson / postJson / patchJson 共用的选项。
 */
export type ApiHelperOptions = Omit<IApiRequestOptions, 'method'>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '');
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function createHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

function parseJsonResponse(text: string, status: number): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('Invalid JSON response', status, { text });
  }
}

function getErrorMessage(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
    return data.message || 'Request failed';
  }

  return 'Request failed';
}

function resolveFetch(fetchImpl?: ApiFetch): ApiFetch {
  const resolved = fetchImpl ?? (globalThis.fetch as unknown as ApiFetch | undefined);

  if (!resolved) {
    throw new ApiError('Network error', 0, new Error('globalThis.fetch is not available.'));
  }

  return resolved;
}

async function sendJson<TResponse>(
  path: string,
  method: ApiMethod,
  options: ApiHelperOptions,
  body?: unknown,
): Promise<TResponse> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? readApiConfig().apiBaseUrl);
  const url = `${baseUrl}${normalizePath(path)}`;
  const fetchImpl = resolveFetch(options.fetchImpl);

  try {
    logger.debug(LOG_EVENTS.API_REQUEST, { method, url });

    const response = await fetchImpl(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: createHeaders(options.authToken),
      method,
    });
    const text = await response.text();

    logger.debug(LOG_EVENTS.API_RESPONSE, {
      method,
      preview: previewResponseText(text),
      status: response.status,
      url,
    });

    const data = parseJsonResponse(text, response.status);

    if (!response.ok) {
      throw new ApiError(getErrorMessage(data), response.status, data);
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.warn(LOG_EVENTS.API_ERROR, { error, method, url });
    throw new ApiError('Network error', 0, error);
  }
}

/**
 * 发起 JSON API 请求：统一 base URL、JSON header、auth header、text-first 解析与错误归一。
 *
 * @param path - 以 / 开头的接口路径。
 * @param options - 请求选项，必须包含 method。
 * @returns 解析后的响应体。
 */
export function requestJson<TResponse = unknown>(path: string, options: IApiRequestOptions): Promise<TResponse> {
  const { method, ...helperOptions } = options;

  return sendJson<TResponse>(path, method, helperOptions);
}

/**
 * GET JSON。
 *
 * @param path - 以 / 开头的接口路径。
 * @param options - 请求选项。
 * @returns 解析后的响应体。
 */
export function getJson<TResponse = unknown>(path: string, options: ApiHelperOptions = {}): Promise<TResponse> {
  return sendJson<TResponse>(path, 'GET', options);
}

/**
 * POST JSON。
 *
 * @param path - 以 / 开头的接口路径。
 * @param body - 请求体。
 * @param options - 请求选项。
 * @returns 解析后的响应体。
 */
export function postJson<TResponse = unknown>(
  path: string,
  body: unknown,
  options: ApiHelperOptions = {},
): Promise<TResponse> {
  return sendJson<TResponse>(path, 'POST', options, body);
}

/**
 * PATCH JSON。
 *
 * @param path - 以 / 开头的接口路径。
 * @param body - 请求体。
 * @param options - 请求选项。
 * @returns 解析后的响应体。
 */
export function patchJson<TResponse = unknown>(
  path: string,
  body: unknown,
  options: ApiHelperOptions = {},
): Promise<TResponse> {
  return sendJson<TResponse>(path, 'PATCH', options, body);
}
