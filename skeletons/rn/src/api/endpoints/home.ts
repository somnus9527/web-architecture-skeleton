import { getJson } from '@/api/client';

import type { IHomeSummary } from '@/domain/contracts/home';

/**
 * 读取工作台摘要。
 *
 * @returns 工作台摘要。
 */
export async function fetchHomeSummary(): Promise<IHomeSummary> {
  return await getJson<IHomeSummary>('/home/summary');
}
