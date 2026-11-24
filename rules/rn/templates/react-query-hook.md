# React Query Hook Template

> 上级规则：`docs/rules/rn/state-management.md`、`docs/rules/rn/api.md`、`docs/rules/rn/error-handling.md`。

## Query Hook

```ts
// src/components/<feature>/use-item-detail-query.ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getItemDetail } from '@api/endpoints/<resource>';
import { useLocaleStore } from '@domain/locale/locale-store';
import type { ItemDetailResponse } from '@domain/contracts/<resource>';

export function useItemDetailQuery(id: string): UseQueryResult<ItemDetailResponse> {
  const locale = useLocaleStore((state) => state.locale);

  return useQuery({
    queryKey: ['feature', 'item-detail', id, locale],
    queryFn: () => getItemDetail(id, { locale }),
    enabled: Boolean(id),
  });
}
```

## Mutation Hook

```ts
// src/components/<feature>/use-submit-item-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createItem, type ICreateItemRequest } from '@api/endpoints/<resource>';
import { ApiError } from '@api/errors';
import { useAppToast } from '@domain/toast/toast-provider';

interface IUseSubmitItemMutationOptions {
  onSuccess?: (id: string) => void;
}

export function useSubmitItemMutation(options: IUseSubmitItemMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { pushToast } = useAppToast();

  return useMutation({
    mutationFn: (request: ICreateItemRequest) => createItem(request),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['feature'] });
      options.onSuccess?.(response.id);
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t('form.error.generic');
      pushToast({ title: message, variant: 'error' });
    },
  });
}
```

## Screen Usage

```tsx
function ItemDetailScreen({ id }: { id: string }) {
  const query = useItemDetailQuery(id);

  if (query.isLoading) return <Skeleton />;
  if (query.isError) return <EmptyState context="error" onAction={() => query.refetch()} />;
  if (!query.data) return <EmptyState context="detail" />;

  return <ItemDetailContent data={query.data} />;
}
```

## Query Key 规则

- 使用数组：`['feature', 'operation', ...params]`。
- 包含会影响响应的 locale、筛选、分页、身份参数。
- mutation 成功后只 invalidate 受影响的 key 范围。
