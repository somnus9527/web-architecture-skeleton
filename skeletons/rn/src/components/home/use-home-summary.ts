import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { fetchHomeSummary } from '@api/endpoints/home';
import type { IHomeSummary } from '@domain/contracts/home';

/**
 * 工作台摘要查询；缓存时长走 AppProviders 的全局默认值。
 *
 * @returns React Query 结果。
 */
export function useHomeSummary(): UseQueryResult<IHomeSummary, Error> {
  return useQuery({
    queryKey: ['home', 'summary'],
    queryFn: () => fetchHomeSummary(),
  });
}
