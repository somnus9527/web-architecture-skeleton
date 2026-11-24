# 状态管理规则

## 目的

本文件描述 React Native 项目使用 React Query（远端缓存）、Zustand（客户端状态）与 React Context（运行时依赖注入）的标准。

## 状态分层

| 类型                                                              | 工具                      | 位置                                                        |
| ----------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| 远端请求缓存                                                      | `@tanstack/react-query`   | 组件内 `useQuery` / `useMutation`                           |
| 客户端持久状态（locale、theme、session、业务草稿、偏好）          | `zustand` store           | `src/domain/<area>.ts` 或 `src/domain/<area>/store.ts`      |
| 短暂 UI 状态（modal 开关、表单字段、loading）                     | `useState` / `useReducer` | 组件内                                                      |
| 运行时依赖（toast dispatcher、analytics sink、navigation helper） | React Context Provider    | `src/domain/*-provider.tsx` 或 `src/components/providers/*` |

**不允许**：在 React Context 中放频繁变化的状态（每次都会触发整个子树 re-render）；在 Zustand store 中混入 query 结果（缓存职责重叠）。

## React Query

### 全局 QueryClient 默认配置

`@components/providers/app-providers.tsx` 中初始化 QueryClient 时必须显式配置 defaults：

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // 4xx 客户端错误不重试，5xx 最多 2 次重试
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```

### Query Key 命名

- Key 是 `[area, operation, ...params]` 数组：
  ```ts
  useQuery({
    queryKey: ['feature', 'item-detail', id, locale],
    queryFn: () => getItemDetail(id, { locale }),
  });
  ```
- `area` 与 `operation` 使用 kebab-case 业务名。
- 包含 locale / currency 等会影响响应的参数，保证缓存正确隔离。

### Query 必填三态

由 Query 驱动的 screen 必须显式渲染 `isLoading` / `isError` / `isEmpty`（query 成功但数据空）。模版见 `docs/rules/rn/templates/react-query-hook.md`。

### AppState 桥接

App 从后台回前台时触发 stale query refetch；在 root provider 中桥接：

```ts
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    focusManager.setFocused(state === 'active');
  });
  return () => subscription.remove();
}, []);
```

桥接组件命名 `QueryFocusBridge`，放在 `src/components/providers/query-focus-bridge.tsx`。

### Mutation

- Mutation 用于写操作（POST / PATCH / DELETE）；默认 retry 0，避免重复写入。
- 成功后通过 `queryClient.invalidateQueries(['area', 'operation'])` 刷新相关 query。
- 失败通过 `onError` 派发 toast（与 `docs/rules/rn/error-handling.md` 衔接）。

## Zustand Store

### Store 结构

每个业务领域一个 store，位于 `src/domain/<area>.ts`：

```ts
import { create } from 'zustand';

export interface IFeatureStoreState {
  items: IFeatureItem[];
  hasHydrated: boolean;
  hydrateDraft: (storage?: JsonStorage) => Promise<void>;
  addItem: (item: IFeatureItem, options?: IAddFeatureItemOptions) => Promise<void>;
  removeItem: (itemId: string, storage?: JsonStorage) => Promise<void>;
  clearDraft: (storage?: JsonStorage) => Promise<void>;
}

export const useFeatureStore = create<IFeatureStoreState>((set, get) => ({
  items: [],
  hasHydrated: false,
  hydrateDraft: async (storage) => { ... },
  addItem: async (item, options) => { ... },
  // ...
}));
```

模版见 `docs/rules/rn/templates/zustand-store.md`。

### Store 内不允许

- 直接 `import` RN 视图组件（`Text` / `View`）。
- 直接 `import 'react-native-paper'`。
- 直接 `import` UI component（保持纯逻辑层）。
- 直接读取平台 storage（必须经 `src/storage/*` 注入）。

### Store 选择器

- 在组件中使用 selector 避免不必要 re-render：
  ```tsx
  const items = useFeatureStore((state) => state.items);
  const addItem = useFeatureStore((state) => state.addItem);
  ```
- 复杂派生选择器抽 helper：
  ```ts
  export function getSelectedItemCount(state: IFeatureStoreState): number {
    return state.items.reduce((sum, item) => sum + getFeatureItemQuantity(item), 0);
  }
  // 使用
  const total = useFeatureStore(getSelectedItemCount);
  ```

### 持久化

- Store 持久化通过 `src/storage/*` 边界，不直接 import `@react-native-async-storage/async-storage`。
- 持久化通过 `hydrateDraft()` 等显式方法在 Provider mount 时触发；不使用 Zustand 中间件 `persist`（保持持久化时机可控）。

### Store 间通信

- 一个 store 不应直接 `import` 另一个 store；通过 callback / dependency injection 通信。
  ```ts
  featureStore.addItem(item, {
    trackEvent: (name, payload) => analyticsBridge.send(name, payload),
  });
  ```

## React Context Provider

### 适用场景

- 注入 dispatcher / opener / 主题 token / locale / session。
- 提供 setState 入口（如 `setThemePreference`）。

### 不适用场景

- 频繁变化的列表数据（用 Query 或 Store）。
- 跨多层但只 1 个组件用的状态（直接传 props）。

### Provider 文件位置

- UI 相关 Provider（含 RN 视图）：`src/components/providers/*-provider.tsx`。
- 业务状态 Provider（只 hook + context，不含视图）：`src/domain/*-provider.tsx` 或 `src/domain/<area>/<area>-provider.tsx`。

模版见 `docs/rules/rn/templates/provider.md`。

### Provider 使用 hook

每个 Provider 必须提供配套 `use<Name>` hook，并在 context 缺失时 throw：

```ts
export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}
```

## 完成检查

- QueryClient defaults 显式配置；不使用裸 `new QueryClient()`。
- Query key 数组结构含影响响应的所有参数。
- Query 渲染处理 loading / error / empty 三态。
- Zustand store 不 import 视图组件、不直接 import 平台 storage。
- Store selector 在组件中使用，避免无关字段触发 re-render。
- Provider 配套 `use<Name>` hook + null check throw。
