# Zustand Store Template

> 上级规则：`docs/rules/rn/state-management.md`、`docs/rules/rn/storage.md`。

## 适用场景

业务客户端状态、偏好、草稿、会话派生状态等需要跨组件共享且不属于远端 query cache 的状态。

## Store

```ts
// src/domain/<feature>/feature-store.ts
import { create } from 'zustand';
import { readPersistedJson, writePersistedJson, clearPersistedJson, type JsonStorage } from '@storage/persisted-json';

export const FEATURE_DRAFT_STORAGE_KEY = '<app-namespace>.<feature>.draft';

export interface IFeatureItem {
  id: string;
  title: string;
  quantity?: number;
}

export type FeatureAnalyticsEventName = 'feature_item_added' | 'feature_item_removed';
export type FeatureAnalyticsPayload = Record<string, number | string>;
export type FeatureAnalyticsSink = (eventName: FeatureAnalyticsEventName, payload: FeatureAnalyticsPayload) => void;

export interface IAddFeatureItemOptions {
  storage?: JsonStorage;
  trackEvent?: FeatureAnalyticsSink;
}

export interface IFeatureStoreState {
  hasHydrated: boolean;
  items: IFeatureItem[];
  hydrateDraft: (storage?: JsonStorage) => Promise<void>;
  addItem: (item: IFeatureItem, options?: IAddFeatureItemOptions) => Promise<void>;
  removeItem: (itemId: string, storage?: JsonStorage) => Promise<void>;
  clearDraft: (storage?: JsonStorage) => Promise<void>;
}

export const useFeatureStore = create<IFeatureStoreState>((set, get) => ({
  hasHydrated: false,
  items: [],

  hydrateDraft: async (storage) => {
    const persisted = await readPersistedJson<IFeatureItem[]>(FEATURE_DRAFT_STORAGE_KEY, storage);
    set({ items: persisted ?? [], hasHydrated: true });
  },

  addItem: async (item, options) => {
    const nextItems = [...get().items.filter((existing) => existing.id !== item.id), item];
    set({ items: nextItems });
    await writePersistedJson(FEATURE_DRAFT_STORAGE_KEY, nextItems, options?.storage);
    options?.trackEvent?.('feature_item_added', { item_id: item.id });
  },

  removeItem: async (itemId, storage) => {
    const nextItems = get().items.filter((item) => item.id !== itemId);
    set({ items: nextItems });
    await writePersistedJson(FEATURE_DRAFT_STORAGE_KEY, nextItems, storage);
  },

  clearDraft: async (storage) => {
    set({ items: [] });
    await clearPersistedJson(FEATURE_DRAFT_STORAGE_KEY, storage);
  },
}));

export function getSelectedItemCount(state: IFeatureStoreState): number {
  return state.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}
```

## Provider

```tsx
// src/domain/<feature>/feature-provider.tsx
import { useEffect, type ReactNode } from 'react';
import { useFeatureStore } from './feature-store';

interface IFeatureProviderProps {
  children: ReactNode;
}

export function FeatureProvider({ children }: IFeatureProviderProps) {
  useEffect(() => {
    void useFeatureStore.getState().hydrateDraft();
  }, []);

  return children;
}
```

## 测试要点

- hydration 从 storage 恢复。
- add / remove / clear 会同步写 storage。
- selector 不依赖重复状态字段。
- store 不 import RN view、UI component 或平台 storage SDK。
