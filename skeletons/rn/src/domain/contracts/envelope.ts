/**
 * 后端统一响应包装。
 *
 * `code` 为业务码字符串，成功值由各后端约定（本骨架使用 '200'）。
 */
export type JavaApiEnvelope<TData> = {
  /** 业务码。 */
  code: string;
  /** 业务提示。 */
  codeMsg?: string;
  /** 业务数据。 */
  data: TData;
};
