# Feature Page 模板

放 `src/features/<module>/pages/<name>-page.tsx`。页面只做编排：取数、筛选、交互状态与三态分布。

```tsx
import { t } from '@/locale';
import { AsyncState } from '@/shared/components/ui/async-state';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { useRequest } from '@/shared/hooks/use-request';

import { listItems } from '@/features/item/services/item-service';

/**
 * 条目列表页。
 *
 * @returns 页面节点。
 */
export function ItemListPage() {
  const request = useRequest(() => listItems({}), {
    formatError: () => t('common.error.description'),
  });
  const isEmpty = !request.loading && (request.data?.length ?? 0) === 0;

  return (
    <AsyncState
      loading={request.loading}
      error={request.error !== null}
      isEmpty={isEmpty}
      loadingNode={<p className="text-sm text-slate-500">{t('common.loading')}</p>}
      errorNode={<p className="text-sm text-rose-700">{request.errorMessage}</p>}
      emptyNode={<EmptyState title={t('item.list.empty')} />}
    >
      <PageHeader title={t('item.list.title')} />
      <ul>
        {request.data?.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </AsyncState>
  );
}
```

约束：

- 页面不直接调 `fetch` 或拼 URL，一律经 service。
- 三态交给 `AsyncState`，不要每页手写 loading/error/empty。
- 弹窗开关用 `useDisclosure`，提交动作的 pending 用 `useAsyncAction` 或 `Button isPending`。
