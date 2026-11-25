import { getJson } from '@api/client';
import type { ApiHelperOptions } from '@api/client';
import { ApiError } from '@api/errors';
import { logger } from '@api/logger';
import type { JavaApiEnvelope } from '@domain/contracts/envelope';
import type { IHomeSummary } from '@domain/contracts/home';

/**
 * home endpoint 的通用请求选项。
 */
export type HomeEndpointOptions = ApiHelperOptions;

const HOME_SUMMARY_PATH = '/home/summary';

/**
 * 后端约定的成功业务码。
 */
const SUCCESS_CODE = '200';

/**
 * 解包统一 envelope；业务码非成功时抛 ApiError。
 *
 * @param envelope - 后端 envelope。
 * @returns envelope.data。
 */
function unwrapEnvelope<TData>(envelope: JavaApiEnvelope<TData>): TData {
  if (envelope.code !== SUCCESS_CODE) {
    logger.warn('home_envelope_rejected', { code: envelope.code });
    throw new ApiError(envelope.codeMsg ?? 'Business error', 200, envelope);
  }

  return envelope.data;
}

/**
 * 读取工作台摘要。
 *
 * @param options - 请求选项（auth token / 测试注入）。
 * @returns 工作台摘要。
 */
export async function fetchHomeSummary(options: HomeEndpointOptions = {}): Promise<IHomeSummary> {
  const envelope = await getJson<JavaApiEnvelope<IHomeSummary>>(HOME_SUMMARY_PATH, options);

  return unwrapEnvelope(envelope);
}
