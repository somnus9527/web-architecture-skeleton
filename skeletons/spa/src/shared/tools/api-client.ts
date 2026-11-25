import { t } from '@/locale';
import { logger } from '@/shared/services/logger';
import { clearSession, getSessionToken } from '@/shared/store/session-store';

/**
 * 标准 API 响应 envelope。
 */
export interface IApiResponse<TData> {
  /**
   * 业务数据；失败时由具体 endpoint 决定是否为空。
   */
  data: TData;
  /**
   * 后端业务编码，成功统一使用 200。
   */
  code: string;
  /**
   * 面向前端展示前需要再映射的错误说明。
   */
  codeMsg: string | null;
}

/**
 * API 错误上下文。
 */
interface IApiErrorOptions {
  /**
   * HTTP 状态码；网络错误没有状态码。
   */
  status: number | null;
  /**
   * 业务错误码或前端归一错误码。
   */
  code: string;
  /**
   * 原始响应数据，用于后续日志和排障。
   */
  payload?: unknown;
}

/**
 * API client 抛出的统一错误类型。
 */
export class ApiError extends Error {
  /**
   * HTTP 状态码；网络错误为 null。
   */
  readonly status: number | null;

  /**
   * 业务错误码或前端归一错误码。
   */
  readonly code: string;

  /**
   * 原始响应数据，用于后续日志和排障。
   */
  readonly payload?: unknown;

  /**
   * 创建统一 API 错误。
   *
   * @param message - 面向前端错误态的友好说明。
   * @param options - HTTP 与业务错误上下文。
   */
  constructor(message: string, options: IApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.payload = options.payload;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

/**
 * 返回当前 API base URL；具体 mock / real 地址统一来自环境文件。
 *
 * @returns API base URL。
 */
function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * 规范化 API URL，避免 base URL 和 path 拼接时出现重复斜杠。
 *
 * @param path - endpoint path。
 * @returns 完整请求 URL。
 */
function buildApiUrl(path: string): string {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * 把未知 JSON payload 尽量归一成 API envelope。
 *
 * @param payload - fetch JSON 解析结果。
 * @returns API envelope 或 null。
 */
function readApiEnvelope<TData>(payload: unknown): IApiResponse<TData> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (!('code' in payload) || !('data' in payload) || typeof payload.code !== 'string') {
    return null;
  }

  return {
    /**
     * generic endpoint 的 data schema 只能由调用方和 OpenAPI 契约约束；
     * API 边界集中保留这一处断言，避免业务组件继续扩散 JSON 强转。
     */
    data: payload.data as TData,
    code: payload.code,
    codeMsg: 'codeMsg' in payload && typeof payload.codeMsg === 'string' ? payload.codeMsg : null,
  };
}

/**
 * 发起 JSON API 请求，统一处理 HTTP、业务错误码、JSON 解析错误和网络错误。
 *
 * @param path - endpoint path。
 * @param init - fetch 请求配置。
 * @returns 已解包的 API envelope。
 * @throws ApiError 当 HTTP、业务错误码或网络层失败时。
 */
export async function apiRequest<TData>(path: string, init: RequestInit = {}): Promise<IApiResponse<TData>> {
  const headers = new Headers(init.headers);
  const sessionToken = getSessionToken();

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  /* authorization 只来自会话 store，避免在 API client 里散读 localStorage。 */
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  try {
    const response = await fetch(buildApiUrl(path), {
      ...init,
      headers,
    });

    /* 会话失效或越权时立刻清除持久化会话，由路由守卫把用户送回登录页。 */
    if (response.status === 401 || response.status === 403) {
      clearSession();
      logger.warn('api_session_rejected', { path, status: response.status });
    }

    const payload: unknown = await response.json();
    const envelope = readApiEnvelope<TData>(payload);

    if (!response.ok) {
      throw new ApiError(t('api.error.http'), {
        status: response.status,
        code: envelope?.code ?? 'common.http_error',
        payload,
      });
    }

    if (!envelope) {
      throw new ApiError(t('api.error.http'), {
        status: response.status,
        code: 'common.invalid_response',
        payload,
      });
    }

    if (envelope.code !== '200') {
      throw new ApiError(envelope.codeMsg ?? t('api.error.http'), {
        status: response.status,
        code: envelope.code,
        payload,
      });
    }

    return envelope;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.warn('api_request_failed', { error, path });
    throw new ApiError(t('api.error.network'), {
      status: null,
      code: 'common.network_error',
      payload: error,
    });
  }
}
