# API Client 模版

> 上级规则：`docs/rules/rn/api.md`、`docs/rules/rn/observability.md`、`docs/rules/rn/api.md`。
>
> 建议落地位置：`src/api/client.ts` + `src/api/errors.ts` + `src/api/config.ts`。

## 适用场景

新项目搭建 API 层，或在现有项目中复用 / 扩展 API client。

## 完整模版

### `src/api/errors.ts`

```ts
export type ApiErrorData = unknown;

/**
 * API client 统一抛出的错误对象，供 React Query、store 和 UI 错误态识别。
 */
export class ApiError extends Error {
  /**
   * HTTP 状态码；网络错误或请求未抵达后端时使用 0。
   */
  readonly status: number;

  /**
   * 后端错误响应体或网络层诊断数据；没有响应体时保持 undefined。
   */
  readonly data: ApiErrorData | undefined;

  constructor(message: string, status: number, data?: ApiErrorData) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
```

### `src/api/config.ts`

```ts
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const VALID_API_ENVIRONMENTS = new Set<ApiEnvironment>(['development', 'staging', 'test', 'production', 'mock']);

export type ApiEnvironment = 'development' | 'staging' | 'test' | 'production' | 'mock';

export interface IExpoPublicEnv {
  EXPO_PUBLIC_ANALYTICS_ENABLED?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  EXPO_PUBLIC_APP_ENV?: string;
}

export interface IApiConfig {
  analyticsEnabled: boolean;
  apiEnvironment: ApiEnvironment;
  apiBaseUrl: string;
}

/**
 * 静态读取 Expo public env，确保 Expo CLI 能把 .env 中的 EXPO_PUBLIC_* 注入客户端 bundle。
 */
export function getExpoPublicEnv(): IExpoPublicEnv {
  return {
    EXPO_PUBLIC_ANALYTICS_ENABLED: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  };
}

function readOptionalString(env: IExpoPublicEnv, key: keyof IExpoPublicEnv): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function readRequiredString(env: IExpoPublicEnv, key: keyof IExpoPublicEnv): string {
  const value = readOptionalString(env, key);
  if (!value) {
    throw new Error(`${key} is required in the loaded Expo public env.`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function readBoolean(env: IExpoPublicEnv, key: keyof IExpoPublicEnv, defaultValue: boolean): boolean {
  const value = readOptionalString(env, key);
  if (value === undefined) return defaultValue;
  return TRUE_ENV_VALUES.has(value.toLowerCase());
}

function readApiEnvironment(env: IExpoPublicEnv): ApiEnvironment {
  const appEnv = readRequiredString(env, 'EXPO_PUBLIC_APP_ENV').toLowerCase();
  if (VALID_API_ENVIRONMENTS.has(appEnv as ApiEnvironment)) {
    return appEnv as ApiEnvironment;
  }
  throw new Error('EXPO_PUBLIC_APP_ENV must be one of development, staging, test, production, mock.');
}

/**
 * 汇总 API 运行时配置；从 .env 读取，缺失立即 throw，不使用源码 fallback。
 */
export function readApiConfig(env: IExpoPublicEnv = getExpoPublicEnv()): IApiConfig {
  const apiEnvironment = readApiEnvironment(env);
  const apiBaseUrl = normalizeBaseUrl(readRequiredString(env, 'EXPO_PUBLIC_API_BASE_URL'));
  return {
    analyticsEnabled: readBoolean(env, 'EXPO_PUBLIC_ANALYTICS_ENABLED', false),
    apiEnvironment,
    apiBaseUrl,
  };
}
```

### `src/api/client.ts`

```ts
import { readApiConfig } from '@api/config';
import { ApiError } from '@api/errors';
import { logger } from '@api/logger';

export type ApiMethod = 'GET' | 'PATCH' | 'POST' | 'DELETE';

export interface IApiFetchInit {
  body?: string;
  headers: Record<string, string>;
  method: ApiMethod;
}

export interface IApiFetchResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type ApiFetch = (url: string, init: IApiFetchInit) => Promise<IApiFetchResponse>;

export interface IApiRequestOptions {
  authToken?: string;
  baseUrl?: string;
  fetchImpl?: ApiFetch;
  method: ApiMethod;
}

export type ApiHelperOptions = Omit<IApiRequestOptions, 'method'>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
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
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message
  ) {
    return data.message;
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

/**
 * 发起 JSON API 请求。统一处理 base URL、JSON header、auth header、text-first
 * 解析、HTTP 错误和网络错误，是 endpoint wrapper 唯一应直接依赖的底层请求能力。
 */
export async function requestJson<TResponse = unknown>(path: string, options: IApiRequestOptions): Promise<TResponse> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? readApiConfig().apiBaseUrl);
  const url = `${baseUrl}${normalizePath(path)}`;
  const fetchImpl = resolveFetch(options.fetchImpl);

  try {
    logger.debug('api_request', { method: options.method, url });

    const response = await fetchImpl(url, {
      headers: createHeaders(options.authToken),
      method: options.method,
    });
    const text = await response.text();
    logger.debug('api_response', {
      method: options.method,
      url,
      status: response.status,
      preview: text,
    });

    const data = parseJsonResponse(text, response.status);

    if (!response.ok) {
      throw new ApiError(getErrorMessage(data), response.status, data);
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn('api_error', { method: options.method, url, error });
    throw new ApiError('Network error', 0, error);
  }
}

export function getJson<TResponse = unknown>(path: string, options: ApiHelperOptions = {}): Promise<TResponse> {
  return requestJson<TResponse>(path, { ...options, method: 'GET' });
}

async function writeJson<TResponse>(
  path: string,
  method: 'PATCH' | 'POST',
  body: unknown,
  options: ApiHelperOptions,
): Promise<TResponse> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? readApiConfig().apiBaseUrl);
  const url = `${baseUrl}${normalizePath(path)}`;
  const fetchImpl = resolveFetch(options.fetchImpl);

  try {
    logger.debug('api_request', { method, url });

    const response = await fetchImpl(url, {
      body: JSON.stringify(body),
      headers: createHeaders(options.authToken),
      method,
    });
    const text = await response.text();
    logger.debug('api_response', { method, url, status: response.status, preview: text });

    const data = parseJsonResponse(text, response.status);

    if (!response.ok) {
      throw new ApiError(getErrorMessage(data), response.status, data);
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn('api_error', { method, url, error });
    throw new ApiError('Network error', 0, error);
  }
}

export function postJson<TResponse = unknown>(
  path: string,
  body: unknown,
  options: ApiHelperOptions = {},
): Promise<TResponse> {
  return writeJson<TResponse>(path, 'POST', body, options);
}

export function patchJson<TResponse = unknown>(
  path: string,
  body: unknown,
  options: ApiHelperOptions = {},
): Promise<TResponse> {
  return writeJson<TResponse>(path, 'PATCH', body, options);
}
```

## 注意点

- `authToken` 必须由调用方传入，client 不读 storage（避免循环依赖）。
- `text()` 先于 `JSON.parse()`：空 body 不触发 JSON 异常。
- 所有错误统一抛 `ApiError`（HTTP 4xx/5xx / 网络 / JSON 解析）。
- 日志走 `@api/logger`（详见 `docs/rules/rn/templates/` 下 logger 相关或 `docs/rules/rn/observability.md`）。
- `fetchImpl` 可注入用于测试。

## 测试模版

```ts
// src/test/api/client.test.ts
import { requestJson } from '@api/client';
import { ApiError } from '@api/errors';

describe('API client', () => {
  it('throws ApiError on 4xx', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'Not found' }),
    });

    await expect(requestJson('/missing', { method: 'GET', fetchImpl, baseUrl: 'https://test.api' })).rejects.toThrow(
      ApiError,
    );
  });

  it('parses empty body as undefined', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    });

    const result = await requestJson('/empty', {
      method: 'GET',
      fetchImpl,
      baseUrl: 'https://test.api',
    });
    expect(result).toBeUndefined();
  });
});
```
