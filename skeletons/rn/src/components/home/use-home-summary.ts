import { useQuery } from '@tanstack/react-query';

import { fetchHomeSummary } from '@/api/endpoints/home';

import type { IHomeSummary } from '@/domain/contracts/home';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * 工作台摘要查询。
 *
 * @returns React Query 结果。
 */
export function useHomeSummary(): UseQueryResult<IHomeSummary, Error> {
  return useQuery({
    queryKey: ['home', 'summary'],
    queryFn: fetchHomeSummary,
    staleTime: 30000,
  });
}
