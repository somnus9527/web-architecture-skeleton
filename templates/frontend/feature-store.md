# Feature Store 模板

放 `src/features/<module>/store/<module>-store.ts`，**只放跨组件共享的客户端状态**。

```ts
import { create } from 'zustand';

/**
 * 模块共享的筛选状态。
 */
interface IItemFilterState {
  /**
   * 当前关键词。
   */
  keyword: string;
  /**
   * 当前状态筛选。
   */
  status: string;
  /**
   * 更新关键词。
   */
  setKeyword: (keyword: string) => void;
  /**
   * 更新状态筛选。
   */
  setStatus: (status: string) => void;
}

/**
 * 模块级筛选 store。
 */
export const useItemFilterStore = create<IItemFilterState>((set) => ({
  keyword: '',
  status: 'all',
  setKeyword: (keyword) => set({ keyword }),
  setStatus: (status) => set({ status }),
}));
```

约束：

- 服务端数据不进 store；它归 `useRequest` 管。
- 单组件自己的开关用 `useDisclosure`，不要进 store。
- 需要持久化时按 `rules/frontend/store.md` 的凭证与版本化条款处理。
