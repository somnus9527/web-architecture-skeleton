# Shared Capabilities

跨 feature 的共享资产清单与上升流程。**写业务 hook 或组件前，先查这里；命中就复用。**

## 准入标准

一条能力进入 `src/shared` 需要同时满足：

1. 至少两个 feature 真实使用，或已有明确的第二个使用方。
2. 与业务数据无关：不 import `@/features/**`，不内置业务枚举、文案与埋点。
3. 单一职责：一个文件只解决一个问题，不做"万能 hook"。

不满足时留在 `features/<module>/`，等第二个使用方出现再上升。

## Hook 原语

| Hook                | 用途                                                | 何时不要用                  |
| ------------------- | --------------------------------------------------- | --------------------------- |
| `useRequest`        | 异步读取的数据 / loading / error / refetch / mutate | 写操作                      |
| `useAsyncAction`    | 写操作的 pending / error / 并发键                   | 读取                        |
| `useDebouncedValue` | 值去抖                                              | 要做请求时另接 `useRequest` |
| `useDisclosure`     | 布尔开关                                            | 需要跨组件共享时用 store    |

判定表：

- 需要"拉数据、重试、本地更新" → `useRequest`。
- 需要"提交、删除、推进状态、按钮 pending" → `useAsyncAction`。
- 需要"输入停顿后再处理" → `useDebouncedValue`，请求再交给 `useRequest`。
- 需要"开/关弹窗或抽屉" → `useDisclosure`。

## 反模式

- 每个模块各写一份 `useXxxRequest`：应组合 `useRequest`。
- 复制 `useDebounce` / `useLocalStorage` / `usePagination`：先查上表与 `templates/frontend/`。
- 把 `t(` 或 logger 事件名塞进共享 hook：文案与事件名由调用方注入。
- 把业务枚举（如订单状态）放进共享组件：业务映射留在 feature，组件只接受语义化 tone。

## 目录与命名

- Hook 放 `src/shared/hooks/use-<kebab>.ts`，导出 `use<Camel>`。
- 共享组件放 `src/shared/components/ui/`，文件名 kebab-case，组件名 PascalCase。
- 新增原语时同步更新本文与 `src/shared/hooks/README.md`，两处必须一致。
