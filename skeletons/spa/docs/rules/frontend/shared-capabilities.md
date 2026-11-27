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
- 共享组件放 `src/shared/ui/`，文件名 kebab-case，组件名 PascalCase。
- 新增原语时同步更新本文与 `src/shared/hooks/README.md`，两处必须一致。

## 注册表与检查

- 能力清单位于 `docs/capabilities.json`，随骨架物化下发；新增共享 hook/util 必须登记，`pnpm check:reuse` 校验路径存在、导出名匹配、`src/shared/hooks` 下无漏登记。
- 写业务代码前先查：`pnpm reuse:list`，或直接看注册表的 `purpose`。
- `pnpm check:reuse` 已接入 `quality:check` 与 pre-commit，命中以下模式直接失败：
  - R1 `useEffect` + `setLoading` 一类手写请求三态 → `useRequest` / `useAsyncAction`；
  - R2 `setTimeout` + `clearTimeout` 手写去抖 → `useDebouncedValue`；
  - R3 业务层直连 `localStorage` / `sessionStorage` / `matchMedia`；
  - R4 feature 内新建通用名组件（`button.tsx` 等）→ 进 `src/shared/ui`；
  - R5 深引 `@/shared/hooks/*`、`@/shared/ui/*` → 走 barrel；
  - R6 feature 内直接 `fetch` / `axios` → `api-client` + feature service。
- L2 函数体相似度（5-gram Jaccard ≥ 0.82 且 ≥ 120 token）只在 `--tracked` 与增量检查跑，命中提示复用或上升为共享能力。
- **无合法出口不设规则**：新增检测前必须先有对应能力，否则先补能力再上规则。
- 例外写 `.agents/architecture-exceptions.json`，可带 `rule` 精确到规则；必须带 `reason` 与 90 天内到期日，过期或超期即失败。
- 规则上线晚于项目初始化时，用 `node scripts/check-reuse.mjs --baseline` 生成 `.agents/reuse-baseline.json`（90 天到期，按片段指纹匹配）；代码一改指纹失效，必须重新处理。
