# Feature Service 模板

放 `src/features/<module>/services/<module>-service.ts`。

```ts
import { apiClient } from '@/shared/tools/api-client';

import type { IItemDto, IItemQueryDto } from '@/types/dto/item.types';

/**
 * 查询条目列表。
 *
 * @param query - 查询条件。
 * @returns 条目列表。
 */
export async function listItems(query: IItemQueryDto): Promise<IItemDto[]> {
  const response = await apiClient.get<IItemDto[]>('/items', { params: query });

  return response.data;
}

/**
 * 创建条目。
 *
 * @param payload - 创建载荷。
 * @returns 新建条目。
 */
export async function createItem(payload: Pick<IItemDto, 'name'>): Promise<IItemDto> {
  const response = await apiClient.post<IItemDto>('/items', payload);

  return response.data;
}
```

约束：

- 方法名保持稳定，mock 换成真实接口时不改调用方。
- 不在这里做文案、提示、路由跳转；这些属于 hook 或页面。
- 不在 service 里 `try/catch` 后吞错，错误交给 `useRequest` / `useAsyncAction` 处理。
