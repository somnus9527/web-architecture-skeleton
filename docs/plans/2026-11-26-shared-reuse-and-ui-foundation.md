# 共享复用体系与 UI 基础修复文档

- 日期：2026-11-26
- 状态：共享复用体系设计待实施；UI 基础（antd 6 + 原生 CSS + `@/shared/ui`）已落地，页面视觉回归和暗色模式后续再做。
- 前置决策（2026-11-26 已确认）：UI 统一 SPA/SSR；撤掉 Tailwind，样式改为原生 CSS + CSS 变量；组件库使用 Ant Design 6.x，MUI 彻底移除。
- 关联文档：[五项优化方案](./2026-11-25-five-optimizations.md)、[前端安全规则](../../rules/frontend/frontend-security.md)、[共享能力规则](../../rules/frontend/shared-capabilities.md)、[UI 规则](../../rules/frontend/ui-style-and-components.md)。

## 0. 实施状态

- 共享复用：仅设计，未实施 registry/检测器/生成器；等后续单独排期。
- UI 基础：已从 MUI/Tailwind 切到 antd 6 + 原生 CSS + CSS 变量；`src/shared/ui` 统一出口；MUI/Emotion/Tailwind 依赖和配置已移除；SPA/SSR build、typecheck、test 通过。
- 共享 UI 晋升规则已写入 `rules/frontend/ui-style-and-components.md`：facade 可随用随加，composite 必须有至少两个真实使用方或横切约束。
- 本文的 U0–U6 已执行；U7（旧包装清理/视觉回归）和暗色模式待后续。

## 1. 为什么两件事要一起设计

共享复用和 UI 基础原语看起来是两个问题，实际共享同一套失败模式：

- 规范只写“应该复用/应该用公共组件”，没有可查询的目录；
- AI 或开发者写新代码时，不知道已有能力，或知道但复用成本高于重写；
- 没有门禁在提交时发现“又写了一份”，只能靠 review；
- 组件没有统一出口和样式边界，业务只能深引文件或直接写原生标签；
- 一旦样式体系从 Tailwind 切到原生 CSS，旧的 `className` 写法会整体失效，必须先把 token 和组件 API 稳定下来。

因此本文分两部分：**A. 共享复用体系**（hook/service/util 的发现、生成、检测、门禁）；**B. UI 边界 + 基础原语**（统一 SPA/SSR、原生 CSS + CSS 变量、组件目录与边界）。两者共享“注册表 + 生成器 + 门禁 + agent 流程”的方法，但不合并成一张大表：UI 组件有自己的 catalog，避免 registry 变成万能清单。

## 2. 当前基线

### 2.1 已有资产

- `shared-assets/src/shared/hooks/`：`useRequest`、`useAsyncAction`、`useDebouncedValue`、`useDisclosure`。
- `shared-assets/src/shared/ui/`：`Button`、`Input`、`Select`、`AsyncState`、`EmptyState`、`PageHeader`、`StatCard`、`FieldRow`、`StatusPill`。
- 架构测试：`shared-capabilities`（文档承诺的 hook 必须存在）、`hook-duplication`（feature 内不得手写请求三态/直读 storage）、`shared-ui-contract`（UI 不反向依赖 feature）、`ui-catalog`（文档承诺的组件必须存在）。
- 规则：`shared-capabilities.md` 有准入标准和反模式；`ui-style-and-components.md` 有组件表和复用规则。

### 2.2 已暴露的问题

- `shared-capabilities` 只验证“文档里列出的 hook 文件存在”，不验证业务是否使用；
- `hook-duplication` 只扫 `features/**/use-*.ts` 里的 `useEffect + setLoading/setError`，抓不到：
  - 组件内联 hook；
  - `setTimeout` 去抖、分页、`matchMedia`、`navigator.clipboard`、`IntersectionObserver`；
  - service 里自己拼 `fetch`；
  - 复制 formatter、日期/金额格式化；
  - 复制整个函数体。
- UI 原语没有统一出口；SPA 业务页直接用原生 `<input>/<select>/<button>`，SSR 业务页直接 import MUI；
- 规则让派生项目自建 `ConsoleButton/ConsoleModal/...`，等于官方承认“骨架不提供，你们自己长”；
- 没有 UI catalog 的“组件 → 文件 → 导出 → 使用方”双向校验；
- 样式已从 Tailwind 切到原生 CSS + 变量，旧 `className` 工具类已移除，token 和组件边界已固定。

## Part A：共享复用体系

## 3. 目标

- 新增能力前，开发者/AI 能在 10 秒内查到“有没有现成的”；
- 命中能力时，复用成本低于重写；
- 自己写重复实现时，提交阶段会失败并给出明确替代；
- 新共享能力有登记、测试、文档、owner，不会成为孤儿；
- 例外可审计、可过期，不会永久豁免。

## 4. 能力注册表

### 4.1 文件

新增 `shared-assets/capabilities.json`，物化到各 skeleton 的 `src/shared/capabilities.json` 或 `docs/capabilities.json`（二选一，建议放 `src/shared/capabilities.json` 便于脚本读取）。

### 4.2 Schema

```json
[
  {
    "id": "use-request",
    "kind": "hook",
    "export": "useRequest",
    "path": "src/shared/hooks/use-request.ts",
    "purpose": "异步读取的数据 / loading / error / refetch / mutate",
    "replaces": ["手写 loading/error 三态", "per-feature fetch wrapper"],
    "detect": {
      "signatures": ["setLoading", "setIsLoading", "setLoadState", "setError"],
      "requires": ["useEffect"],
      "exclude": ["@/shared/hooks"]
    },
    "since": "2026-11-24",
    "owner": "frontend-platform"
  },
  {
    "id": "safe-redirect",
    "kind": "util",
    "export": "safeRedirect",
    "path": "src/shared/security/safe-redirect.ts",
    "purpose": "登录/操作回跳只允许站内相对路径",
    "replaces": ["手写 redirect 参数判断"],
    "detect": {
      "signatures": ["redirect", "returnUrl", "next"],
      "requires": ["location", "navigate"]
    },
    "since": "2026-11-26",
    "owner": "frontend-platform"
  }
]
```

字段约束：

- `id` kebab-case，全局唯一；
- `kind` 只允许 `hook | service | util | formatter | security`；
- `export` 必须是真实导出名；
- `path` 必须是仓库相对路径；
- `detect` 是检测器输入，不是装饰；
- `owner` 用于过期/评审；
- UI 组件不放进这张表，放 `ui-catalog.json`。

### 4.3 准入标准（沿用并强化）

1. 至少两个 feature 真实使用，或已有明确第二使用方；
2. 与业务数据无关：不 import `@/features/**`，不内置业务枚举、文案、埋点；
3. 单一职责：一个文件只解决一个问题，不做万能 hook；
4. 有测试；没有测试不允许登记；
5. 有文档行；文档与 registry 由脚本双向校验。

不满足时留在 `features/<module>/`，等第二使用方出现再上升。

## 5. 检测器

新增 `scripts/check-reuse.mjs`，支持：

```bash
node scripts/check-reuse.mjs --staged
node scripts/check-reuse.mjs --tracked
node scripts/check-reuse.mjs --files a.ts b.tsx
node scripts/check-reuse.mjs --suggest "分页"
```

### 5.1 模式 A：签名命中（快，pre-commit）

| 能力                              | 命中特征                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `useRequest`                      | `useEffect` + `setLoading/setIsLoading/setLoadState` + `setError`，且未 import `@/shared/hooks` |
| `useAsyncAction`                  | `setIsSubmitting/setPending/setIsPending` + `try/finally`                                       |
| `useDebouncedValue`               | `setTimeout` + `clearTimeout` 出现在 `use*` 文件                                                |
| `useDisclosure`                   | `isOpen` + `setIsOpen/setOpen`                                                                  |
| `usePagination`（新增）           | `page/pageSize` + `setPage`                                                                     |
| `useMediaQuery`（新增）           | `matchMedia`                                                                                    |
| `useCopyToClipboard`（新增）      | `navigator.clipboard`                                                                           |
| `useIntersectionObserver`（新增） | `new IntersectionObserver`                                                                      |
| `api-client`                      | `fetch(` / `axios` / 手拼 base URL，出现在 `features/**/services/**`                            |
| `formatters`                      | `Intl.NumberFormat` / `Intl.DateTimeFormat` / `dayjs` / `date-fns` 重复                         |
| `safe-redirect`                   | 手写 `redirect` / `returnUrl` / `next` 参数判断                                                 |

签名命中只报“疑似”，必须给替代项和迁移示例。

### 5.2 模式 B：函数体相似（准，CI/定时）

用项目已有的 `typescript` 依赖解析 TS/TSX：

1. 抽取长度 `>= 15` 行的函数/箭头函数；
2. token 归一化：标识符 → `$id`，字面量 → `$lit`，去注释/空白；
3. 跨文件比较归一化 token 序列的哈希/相似度（Jaccard >= 0.92 或完全一致）；
4. 忽略测试、生成代码、`src/shared/**` 内部同文件；
5. 输出两边路径、行号、相似度、建议能力 id；
6. 误报通过 `.agents/reuse-exceptions.json` 登记，带 `reason/owner/expiresAt`。

### 5.3 检测边界

- 不扫描 `node_modules`、`dist`、`.next`、生成文件；
- 不把“同名的两个业务函数”直接判违规，必须相似度/签名同时命中；
- 不把 `useState` + `useEffect` 的普通组件状态误判为请求三态；
- 例外必须逐条说明，不允许全局关闭。

## 6. 生成器与工具

### 6.1 `gen:hook`

```bash
pnpm gen:hook use-pagination
```

生成：

- `src/shared/hooks/use-pagination.ts` + 测试；
- registry 条目；
- `shared-capabilities.md` 行；
- 在骨架仓库中写入 `shared-assets/`，然后跑 `node tools/materialize.mjs`。

### 6.2 `gen:service`

```bash
pnpm gen:service order list-orders
```

只生成调用 `apiRequest` 的 service + 类型占位，不生成 `fetch`。

### 6.3 `check:reuse --suggest`

按 registry 的 `purpose/replaces/detect` 返回候选，AI 在写新 hook 前先跑一次。输出示例：

```text
命中：use-debounced-value
理由：你在 useOrderSearch 中手写了 setTimeout + clearTimeout
迁移：import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
```

## 7. Agent 与提交流程

### 7.1 AGENTS

在 `skeletons/*/AGENTS.md` 的 Always-on 增加：

- 写任何 hook/service/util 前，先读 `src/shared/capabilities.json` 或跑 `pnpm check:reuse --suggest`；
- 命中就复用；不命中且满足准入标准，先登记 registry 再写代码；
- 不满足准入标准，留在 feature，并在提交信息写 `Reuse-Check: none (<reason>)`。

### 7.2 commit-msg

新增 trailer：

```text
Reuse-Check: use-request
# 或
Reuse-Check: none (single-use, only orders page)
```

触发条件：staged 新增 `src/features/**/hooks/use-*.ts`、`src/features/**/services/**`、或 `src/shared/**` 新能力。缺 trailer 时 commit-msg 失败。

### 7.3 PR/评审

PR 模板增加：

- [ ] 新增 hook/service 前查过 registry；
- [ ] 新增共享能力已登记并带测试；
- [ ] 重复实现例外已写 reason/expiry。

## 8. 例外与治理

`.agents/reuse-exceptions.json`：

```json
[
  {
    "path": "src/features/legacy/hooks/use-legacy-request.ts",
    "capability": "use-request",
    "reason": "legacy adapter keeps its own retry semantics until migration",
    "owner": "team-a",
    "expiresAt": "2027-03-31"
  }
]
```

规则：

- 例外按文件+能力登记，不能全局关闭；
- 过期自动失败；
- 每季度清理一次；
- 例外数量作为治理指标。

## 9. 实施阶段

| 阶段 | 内容                                                                                    | 验收                                         |
| ---- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| A1   | registry + `check-reuse` 签名模式 + staged 接入                                         | 新 feature hook 无登记/无复用说明时失败      |
| A2   | 补 `usePagination/useMediaQuery/useCopyToClipboard/useIntersectionObserver` + formatter | 每个能力有测试、有 registry、有文档          |
| A3   | AST 相似度检测 + 例外                                                                   | 复制函数体能被抓到，误报可登记               |
| A4   | 生成器 + `--suggest` + AGENTS/技能/PR 模板                                              | 新 hook 默认走生成器，review 不再靠记忆      |
| A5   | 度量                                                                                    | 新增 feature hook 复用率、重复实现数、例外数 |

## Part B：UI 边界 + 基础原语

## 10. 前置决策与依赖

2026-11-26 已确认：

- UI 统一 SPA/SSR；
- 撤掉 Tailwind；
- 样式改为原生 CSS + CSS 变量；
- UI 组件库使用 **Ant Design 6.x**，MUI 彻底移除；
- 所有业务 UI 经 `@/shared/ui`，但 `@/shared/ui` 不是垃圾场：只有 facade 或达到晋升条件的 composite 才能进入。

因此本文按以下设计：

1. **共享原语不绑定 Tailwind**，不使用 utility className；
2. **共享原语不暴露 MUI props**；antd 只作为 `src/shared/ui` 的内部实现；
3. **样式统一走 CSS 变量 token + 普通 CSS class**；
4. **SPA/SSR 共用同一套 TSX + CSS**，差异只在应用入口、Provider 和路由适配；
5. 业务代码只认 `@/shared/ui`；antd 直引只允许 `src/shared/ui/**`、`src/shared/theme/antd-theme.ts`、`src/app/providers.tsx`。

### 10.1 Shared UI 晋升规则

`src/shared/ui` 只允许两类导出：

- **facade**：antd 原语的薄出口，如 `Input`、`Select`；不新增自定义 API，可以随用随加。
- **composite**：带项目语义的封装，如 `Button`（pending 语义）、`PageHeader`、`StatCard`、`EmptyState`、`AsyncState`、`StatusPill`。

composite 进入 `src/shared/ui` 必须满足至少一条：

1. 已有两个真实 feature 使用方；
2. 承担安全、可访问性、表单语义、design token 等横切约束；
3. 替代已经出现漂移的重复实现。

单页面业务组件留在 `features/<module>/components/`；禁止 `OrderTable`、`LoginCard`、`DashboardPanel` 这类页面命名进入共享层。每个导出必须登记到 `ui-style-and-components.md`，由 `ui-catalog` 测试校验。

## 11. 目标目录

```text
shared-assets/src/shared/
  theme/
    tokens.css              # :root / [data-theme] CSS 变量
    reset.css               # 轻量 reset，可选
  ui/
    index.ts                # 唯一出口（SSR 额外追加 LinkButton）
    ui.css                  # 共享原语样式
    button.tsx
    input.tsx
    select.tsx
    async-state.tsx
    empty-state.tsx
    field-row.tsx
    page-header.tsx
    stat-card.tsx
    status-pill.tsx
```

建议每个组件一个目录，TSX + CSS 同目录；`index.ts` 统一导出。CSS 由应用入口统一 import 一次，避免 SPA/SSR 对 CSS 导入时机不一致：

```text
src/styles.css
  @import './shared/theme/tokens.css';
  @import './shared/ui/ui.css';
```

如果使用 CSS Modules，需确认 Next RSC/Client Component 与 Vite 的导入边界；当前默认**普通 CSS + 稳定 class 名**，降低跨框架差异。

## 12. Token 设计

CSS 变量分两类：

```css
:root {
  /* 颜色 */
  --color-bg: #ffffff;
  --color-bg-subtle: #f7f8fa;
  --color-text: #1f2329;
  --color-text-muted: #646a73;
  --color-border: #dee0e3;
  --color-primary: #1f6feb;
  --color-primary-hover: #1a5fd0;
  --color-danger: #d92d20;
  --color-success: #12b76a;
  --color-warning: #f79009;

  /* 间距 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* 圆角/阴影/字体 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgb(16 24 40 / 6%);
  --font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-number: 'D-DIN-PRO', var(--font-sans);
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 18px;
}
```

规则：

- 业务页面不写 hex 颜色、字号、圆角、间距常量，只用 token；
- token 变更只改 `tokens.css`；
- 暗色/主题通过 `[data-theme]` 覆盖 token，不复制组件样式；
- 字体仍遵循 `--font-zh/--font-en/--font-number` 的既有规则，统一映射到 `--font-sans`。

## 13. 基础原语清单

### 13.1 P0（先做）

`Button`、`IconButton`、`TextInput`、`TextArea`、`Select`、`Checkbox`、`FormField`、`Dialog`、`Table`、`Pagination`、`Alert`、`Skeleton`、`Spinner`、`Card`、`Badge`、`EmptyState`、`PageHeader`、`StatCard`、`FieldRow`、`AsyncState`、`StatusPill`。

### 13.2 P1（后做）

`Drawer`、`Tabs`、`Tooltip`、`Toast`、`Switch`、`RadioGroup`、`Menu`、`Breadcrumb`。

### 13.3 统一 API 原则

- 只接受语义化 props，不接受 Tailwind class、`sx` 式转义、业务枚举；
- `tone` 用语义联合类型，颜色映射在组件内；
- 文案、`aria-label`、业务数据由调用方注入；
- 交互原语统一 `disabled`、`aria-busy`、`aria-invalid`、`aria-describedby`；
- 受控/非受控行为明确；表单原语支持 `name`、`value`、`onChange`；
- 组件不 import `@/features/**`、不 import 路由、不调用 `t()`。

### 13.4 SPA/SSR 统一注意

- 纯展示组件不写 `'use client'`，可被 RSC 使用；
- 使用状态/事件/Portal 的组件写 `'use client'`，SPA 忽略；
- 不在组件内 import Next/React Router；链接按钮由应用层组合；
- SSR 的 CSS 由根 layout 引入，SPA 由 `main.tsx`/`styles.css` 引入，确保顺序一致；
- 避免 `window`/`document` 在模块顶层访问。

## 14. 边界规则（可执行）

| 规则                                                                                      | 检查                                         |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| `features/**`、`app/**` 禁止原生 `button/input/select/textarea/table/dialog`              | ESLint `no-restricted-syntax` + `check-ui`   |
| `features/**` 禁止直接 import antd/MUI 交互组件                                           | ESLint `no-restricted-imports`               |
| 共享 UI 只能从 `@/shared/ui`（barrel）导入                                                | ESLint patterns + 架构测试                   |
| 不允许第二套 UI 根（`src/shared/ui`、`src/shared/public-ui`、web 的 `src/components/ui`） | 目录扫描                                     |
| feature 内不允许通用组件名（`button.tsx`、`input.tsx`、`modal.tsx`、`table.tsx`）         | 文件名扫描                                   |
| 每个导出必须在 `ui-catalog.json` 登记，文档与文件双向一致                                 | `ui-catalog.test.ts` 扩展                    |
| 业务样式禁止硬编码颜色/字号/圆角                                                          | `check-ui` 扫描 hex/px 常量，tokens 文件豁免 |
| 图标按钮必须有可访问名称                                                                  | `jsx-a11y` + 组件测试                        |
| 禁止新增 Tailwind utility class / Tailwind 依赖                                           | `ui-stack` 架构测试 + 依赖检查               |
| 禁止在共享原语里使用 `sx` 式转义                                                          | 代码评审 + ESLint 限制                       |

例外：

- `global-error.tsx` 允许原生标签（无 Provider 场景）；
- 隐藏 `<input type="file">` 等必须原生的场景走 `.agents/ui-exceptions.json`，带 reason/expiry；
- 测试文件、`@generated` 文件。

## 15. UI Catalog

`ui-catalog.json`：

```json
[
  {
    "name": "Button",
    "path": "src/shared/ui/button.tsx",
    "export": "Button",
    "status": "stable",
    "since": "2026-11-26",
    "a11y": ["keyboard", "disabled", "aria-busy"],
    "owner": "frontend-platform"
  }
]
```

校验：

- `index.ts` 导出的每个组件都在 catalog；
- catalog 每个 path 存在且导出名匹配；
- 文档表格与 catalog 一致；
- `status=deprecated` 的组件必须有替代项和移除日期。

## 16. 迁移阶段

| 阶段 | 内容                                                       | 验收                                          |
| ---- | ---------------------------------------------------------- | --------------------------------------------- |
| U0   | 冻结新增 UI；盘点 SPA/SSR 原生标签、MUI 直引、第二套 UI 根 | 有 baseline 清单，不再新增违规                |
| U1   | 确认 antd 6、CSS 导入方式、主题/暗色策略                   | 决策记录 ADR                                  |
| U2   | `tokens.css` + reset + 公共 CSS 入口                       | token 可被 SPA/SSR 共用，页面无新增硬编码颜色 |
| U3   | P0 原语 + 测试 + catalog + a11y                            | 每个原语有测试、catalog、文档                 |
| U4   | 迁移 SPA/SSR 页面：登录、工作台、showcase、locale-switcher | 业务页无原生交互标签、无 MUI 直引             |
| U5   | 移除 Tailwind 依赖和 utility class                         | `grep` 无 Tailwind 引用，构建通过             |
| U6   | 移除 MUI 依赖与配置                                        | 业务代码零 MUI import                         |
| U7   | 删除旧 UI 包装/第二套根                                    | `check-ui` 零违规                             |

## 17. 验收与负向测试

共享复用：

- 新增 feature hook 无 registry/无 `Reuse-Check` → 失败；
- 手写 `setTimeout` 去抖 → 失败并提示 `useDebouncedValue`；
- 两个 90% 相同函数 → 失败并给相似度；
- 正常组合 `useRequest` + `useAsyncAction` → 通过。

UI：

- 业务页 `<button>` → 失败；
- feature 直接 `import Button from '@mui/material/Button'` → 失败；
- 新增 shared UI 未登记 catalog → 失败；
- 硬编码 `#fff`/`13px` → 失败（tokens 文件豁免）；
- 图标按钮无 `aria-label` → 失败；
- SPA/SSR 同一原语构建、快照/交互测试通过。

## 18. 风险

- **UI 统一与 Tailwind 移除是两件大事**：先 token/原语，再迁页面，最后删依赖；不要一次性全仓替换。
- **MUI 已移除**：公共 API 不暴露 MUI；antd 只允许在 shared/ui/theme/provider 内出现。
- **SSR CSS 顺序**：普通 CSS 全局导入最容易保证 SPA/SSR 一致；CSS Modules 需验证 RSC/Client 边界。
- **视觉回归**：原语迁移必须逐页比对，不能只看构建通过。
- **复用误报**：签名/AST 都会有误报，必须允许带过期时间的例外，且例外可审计。
- **Agent 行为**：没有 `--suggest`、生成器、commit trailer，AI 仍会重写；工具链和流程要一起上。

## 19. 建议顺序

1. UI 前置决策已确认：antd 6、CSS 变量、MUI 移除；暗色策略后置。
2. 共享复用先做 A1/A2（registry + 签名检测 + 补 4 个 hook），成本低、能立即减少重复。
3. UI 先做 U1–U3（token + P0 原语），不要直接迁页面。
4. 再做 U4–U5（页面迁移 + 撤 Tailwind）。
5. MUI 依赖已移除；后续只做页面视觉回归和暗色模式验证。

一句话：**共用一套“注册表 + 生成器 + 门禁 + agent 流程”解决复用；共用一套“token + 原语 + catalog + 边界”解决 UI。两者都不靠文档自觉，靠可失败检查。**
