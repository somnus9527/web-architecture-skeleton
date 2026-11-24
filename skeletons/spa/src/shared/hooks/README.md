# Shared Hooks

跨 feature 复用的原语。写业务 hook 前先查这张表：命中就复用，不命中再判断是否值得上升。

| Hook                | 用途                                                    | 何时用               | 何时不要用                       |
| ------------------- | ------------------------------------------------------- | -------------------- | -------------------------------- |
| `useRequest`        | 一次异步读取的数据 / loading / error / refetch / mutate | 任何"拉数据"的场景   | 写操作；用 `useAsyncAction`      |
| `useAsyncAction`    | 写操作的 pending / error / 并发键                       | 提交、删除、状态推进 | 读取；用 `useRequest`            |
| `useDebouncedValue` | 值去抖                                                  | 搜索输入、筛选联动   | 需要请求时另接 `useRequest`      |
| `useDisclosure`     | 布尔开关                                                | Dialog、Drawer、菜单 | 需要持久化或跨组件共享；用 store |

约束：

- 原语只处理状态与生命周期，**不碰文案、不碰日志事件名、不碰具体 service**。
- 不要合成混合 hook（例如 `useHttpDebounce`）；组合两个原语由业务层完成。
- 新增原语前，先确认已有原语无法通过组合满足。
