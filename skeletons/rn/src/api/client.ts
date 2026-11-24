/**
 * 统一响应包装。
 */
interface IApiEnvelope<TData> {
  /**
   * 业务数据。
   */
  data: TData;
  /**
   * 业务码，成功为 '200'。
   */
  code: string;
  /**
   * 业务提示。
   */
  codeMsg?: string;
}

/**
 * 前端请求错误，保留稳定 code 供 UI 决定文案。
 */
export class ApiError extends Error {
  /**
   * 稳定错误码。
   */
  readonly code: string;

  /**
   * @param code - 稳定错误码。
   * @param message - 调试信息，不直接展示给用户。
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const TIMEOUT_MS = 15000;

/**
 * 发起一次 GET 请求并解包统一响应。
 *
 * @param path - 以 / 开头的接口路径。
 * @returns 解包后的业务数据。
 */
export async function getJson<TData>(path: string): Promise<TData> {
  if (!BASE_URL) {
    throw new ApiError('config_missing', 'EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(`http_${response.status}`, `Request failed with status ${response.status}.`);
    }

    const envelope = (await response.json()) as IApiEnvelope<TData>;
    if (envelope.code !== '200') {
      throw new ApiError(String(envelope.code), envelope.codeMsg ?? 'Business error.');
    }

    return envelope.data;
  } finally {
    clearTimeout(timer);
  }
}
