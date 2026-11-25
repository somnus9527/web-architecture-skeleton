/**
 * API 层错误的数据载荷：后端响应体或网络层诊断信息。
 */
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

  /**
   * @param message - 调试与日志用错误信息；用户文案由 UI 通过 status 决定。
   * @param status - HTTP 状态码；网络错误使用 0。
   * @param data - 后端响应体或网络层诊断数据。
   */
  constructor(message: string, status: number, data?: ApiErrorData) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
