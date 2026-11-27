# UI Style And Shared Components

## 必读场景

- 写任何新页面、新前端组件、筛选区、指标区、列表工具栏或工作台。
- 调整字体、字号、数字展示、时间筛选、进度条、筛选输入框或筛选 select。
- 新增、修改或复用 `src/shared/ui` 下的公共 UI 组件、样式函数和 design token。

## 骨架已内置

下表是骨架自带、可直接复用且不许在业务里再抄一份的组件。派生项目删除或改名，等同于制造第二套视觉语言。

| 组件          | 位置                             | 职责                                           |
| ------------- | -------------------------------- | ---------------------------------------------- |
| `StatusPill`  | `src/shared/ui/status-pill.tsx`  | 短文本状态胶囊，接受 `tone` 与子节点           |
| `Button`      | `src/shared/ui/button.tsx`       | 统一 pending 语义的按钮                        |
| `AsyncState`  | `src/shared/ui/async-state.tsx`  | 加载/错误/空/内容三态出口                      |
| `EmptyState`  | `src/shared/ui/empty-state.tsx`  | 空数据态布局                                   |
| `PageHeader`  | `src/shared/ui/page-header.tsx`  | 页面标题与操作区                               |
| `StatCard`    | `src/shared/ui/stat-card.tsx`    | 指标卡                                         |
| `FieldRow`    | `src/shared/ui/field-row.tsx`    | 只读字段行                                     |
| `ThemeToggle` | `src/shared/ui/theme-toggle.tsx` | 明暗主题切换按钮（icon-only，需传 aria-label） |
| `Input`       | `src/shared/ui/input.tsx`        | antd Input 薄出口                              |
| `Select`      | `src/shared/ui/select.tsx`       | antd Select 薄出口（ARIA combobox）            |
| `TextArea`    | `src/shared/ui/text-area.tsx`    | antd TextArea 薄出口，内部原生 `<textarea>`    |
| `Checkbox`    | `src/shared/ui/checkbox.tsx`     | antd Checkbox 薄出口，内部原生 checkbox        |
| `Dialog`      | `src/shared/ui/dialog.tsx`       | 统一弹窗外壳，footer 由调用方注入              |
| `Table`       | `src/shared/ui/table.tsx`        | antd Table 薄出口，内部真实 `<table>`          |

`src/shared/components/providers/**` 与 `router/**` 属于应用级共享组件，可以持有文案与路由逻辑；
`src/shared/ui/**` 下的原语则不许调用 `t()`、不许 import `@/features/**`，也不许直接 import `antd` 以外的业务依赖。

## 组件扩展与登记

- 通用名组件只能来自 `src/shared/ui`：业务层禁止自建 `button.tsx`、`input.tsx`、`select.tsx`、`textarea.tsx`、`modal.tsx`、`dialog.tsx`、`table.tsx` 等，`check:reuse` 的 R4 会直接失败。
- 每个组件必须登记 `docs/ui-catalog.json`：`name`、`path`、`export`、`status`、`owner`、`scope`、`dom`、`a11y`；本文档表格必须同步，`ui-catalog` 测试做双向校验。
- `scope` 只有两个值：`skeleton`（骨架自带，随物化下发）与 `project`（派生项目自建）。项目自建组件登记 `scope: "project"`，不得藏在 `features/**` 里当私有原语。
- `dom` 标注组件的语义来源：`native-backed`（内部是原生控件）、`aria-pattern`（ARIA 组合模式）、`static`（无交互语义）。标 `aria-pattern` 的组件必须有 `a11y` 清单与对应测试。
- `status: "deprecated"` 必须写 `replacedBy` 与移除日期，否则测试失败。
- **不预先造组件**：composite 至少有两个真实使用方，或承担安全/可访问性/表单语义等横切约束，才允许晋升；只有一个页面使用的留在 `features/<module>/components/`。

## 字体规范

- 全站字体入口固定为 CSS 变量，不得在页面或业务组件里随意写散落字体栈。
- 中文字体使用 `--font-zh`；英文字体使用 `--font-en`；数字、金额、用量、百分比、指标值使用 `--font-number`。
- 默认正文和 antd theme 使用 `--font-sans`；`--font-sans` 由 `html[lang]` 切换，中文环境指向 `--font-zh`，英文环境指向 `--font-en`。
- antd typography 的字体来源必须经过 `src/shared/theme/design-tokens.ts` 的 `designTokens.fontFamily`，再由 `src/shared/theme/antd-theme.ts` 注入，不得在局部重新创建第二套 theme 字体。
- 字体资源引入放在应用全局样式入口（SSR `src/app/layout.tsx` / `src/app/globals.css`；SPA `index.html` / `src/styles.css`）；新增字体必须说明用途、加载权重和回退链，并更新本规范。
- 新页面默认不直接写 `font-family`；确需强调数字字体时，只使用 `font-family: var(--font-number)`。

## 公共 UI 复用规则

- `src/shared/ui` 是项目公共视觉资产入口，用于沉淀 theme、design token、可复用组件和跨页面样式函数。
- 新增同类公共 UI 时优先放入 `src/shared/ui`，保持业务无关；文案、locale、业务数据、颜色语义和埋点由调用方注入。
- 业务页面开发时必须先找可复用对象：公共组件、公共样式函数、公共 style object、公共数据结构、公共格式化工具。只有确认现有对象不能表达当前场景时，才允许新增页面级实现。
- 有公共对象时优先使用对象本身，不要复制对象里的属性再局部改一份。例如筛选输入、下拉、分页、日期、进度条、反馈提示、表格分页优先复用 `src/shared/ui`，页面只传参数或叠加极小 className。
- 页面级特例只能做小范围补充，不得复制一份近似组件或近似样式形成第二套视觉语言。
- `src/shared/ui` 只允许两类内容：**facade**（antd 原语的薄出口，如 `Input`/`Select`）和 **composite**（带项目语义的封装，如 `Button`/`PageHeader`）。facade 可以随用随加；composite 必须有至少两个真实使用方，或承担安全/可访问性/表单语义等横切约束。
- 禁止 `OrderTable`、`LoginCard`、`DashboardPanel` 这类页面命名进入 `src/shared/ui`；禁止共享组件 import `@/features/**`、路由模块、`t()`、业务枚举或 API 类型。
- 业务代码只能从 `@/shared/ui` 导入 UI；`antd` 直引只允许出现在 `src/shared/ui/**`、`src/shared/theme/antd-theme.ts` 和 `src/app/providers.tsx`。
- 业务/页面图标以 `lucide-react` 为主，统一从 `@/shared/ui` 的图标 facade 导入；feature 不直接引 `lucide-react`。
- `@ant-design/icons` 由 antd 组件内部使用，不作为业务直接依赖；不要为了“统一”替换 Select 清除、Modal 关闭、DatePicker 箭头等 antd 内部图标。
- lucide 没有合适图标时，允许 feature 直接引用专用图标包；不得在业务组件里手写 SVG path，也不得同一组件混用多套图标风格。
- 公共组件命名使用 PascalCase，文件名使用 kebab-case；类型接口继续遵守 `I` 前缀规则。
- 公共组件必须保留可访问性入口，例如 `aria-label`、`role`、键盘触发和禁用态；不得为了视觉统一牺牲交互语义。
- 弹窗只封装通用外壳（遮罩、标题区、关闭按钮、焦点管理），表单字段、删除说明、业务摘要和接口交互由调用方注入；不得为了复用把不同业务内容抽成“万能弹窗”。

## 交互与视觉基线

- 禁用态只用于真实不可交互状态（`:disabled`、`aria-disabled="true"`）；边框 `#AEB5C5`、背景 `#F8F9FA`、承载信息的文字 `#999`，且不加投影。不得把普通辅助文字或未选中态当成禁用灰。
- 会触发接口调用或状态变更的按钮必须有 pending：禁用防重复、`aria-busy=true`、文案切成 `...` 进行中文案，并保留原语义颜色，不降 opacity；`Button` 已内置，页面不要覆盖。
- focus 状态由公共控件与 token 统一提供，不得出现浏览器原生下拉蓝框或第二套 focus 色。
- 颜色一律走 token（`src/shared/theme/tokens.css` 与 `designTokens`），页面不得散落第二套 hex。
- 表格：表头背景 `#F9FBFC`，数据行默认透明，仅 hover 使用 `#F9FBFF`；active/selected 可以保留独立强调色，但不得替代 hover 基线。
- 状态胶囊用 5 类语义 tone（success / warning / pending / info / danger），同一组胶囊同宽同高；`StatusPill` 只接受语义 tone 与子节点，不认业务枚举。

## 字号层级与密度

- 页面主标题默认 `24px / 700 / 32px line-height`；只有公开站 hero 或营销首屏可使用更大标题。
- 卡片、模块、弹窗标题默认 `18px / 700 / 24px`；抽屉或大弹窗标题可到 `22px / 700 / 30px`。
- 正文说明默认 `13px / 400-500 / 20px`；次级说明、表格辅助信息、标签默认 `11-12px / 500-700 / 16-18px`。
- 按钮和筛选控件默认 `12-14px / 600-700`；普通操作按钮不超过 `14px`，主要按钮可用 `14px / 700`。
- 金额、用量、余额、排行等指标数字使用 `var(--font-number)`，常规指标默认 `24-28px / 700`，核心大数字可到 `34px / 700`。
- 字重优先使用 `400 / 500 / 600 / 700`，避免 `800 / 840 / 850 / 900`；如需强调，优先通过颜色、间距、图标或背景层级完成。
- 页面内不得用 `clamp()` 或 viewport width 直接放大字号；宽屏只增加列数、留白、表格可见列和图表宽度。

## 超大屏适配

- 超大屏断点（`min-width: 120rem` 等）只用于布局扩展：增加网格列、提高图表/表格可用宽度、优化面板比例、减少滚动。
- 超大屏不得把正文、按钮、表格、筛选框、弹窗字段统一放大到 `16px/18px+`。
- 超大屏中的弹窗和抽屉可扩大宽度，但内部字段高度、字号、focus 状态应继续跟公共输入/下拉规则一致。
- 表格在超大屏可以提升 `min-width` 或列宽，但表头和行内容字号仍按 `12-14px` 控制。
- 若某个页面因大量数据分析确需超大屏字号例外，必须在代码旁注释原因，并在交付说明中说明它不是通用规则。

## 列表与表格布局

- 默认列宽策略是“优先不滚动，视觉均衡”：表格默认撑满容器（`width: 100%`），不要直接给整表写大于容器的固定 `min-width`。只有列数多、字段不可省略时才允许横向滚动，并在样式旁注释原因。
- 无特殊语义的普通数据列使用均分或接近均分的弹性列，例如 `repeat(n, minmax(0, 1fr))`；不得出现首列/长文本列被过度放大、短列被挤坏。
- 操作列不是普通数据列：行内有 2 个及以上按钮时，表头最后一列右对齐、行内 actions 靠右、按钮 `flex: 0 0 auto`；列宽按按钮实际总宽度 + gap + 安全余量设定。
- 长 id、邮箱、订单号等字段必须配合 `min-width: 0`、`overflow: hidden`、`text-overflow: ellipsis`、`white-space: nowrap` 或允许换行，不能靠无限放大列宽解决。
- 反例：含操作按钮的 7 列表写成纯 `repeat(7, minmax(0, 1fr))` 导致按钮被挤压；为照顾订单号把首列写成 `30%`；为避免省略把整表 `min-width` 撑到大于常规容器。

## Review Checklist

- 字体是否只通过 `--font-sans`、`--font-zh`、`--font-en`、`--font-number` 或 `designTokens.fontFamily` 进入页面。
- 数字、金额、指标值是否使用 `--font-number`，且没有硬编码另一套数字字体。
- 时间筛选、进度条、筛选输入框和筛选 select 是否复用了 `src/shared/ui` 的现有组件或样式函数。
- 输入框、下拉、textarea、筛选触发器的默认态、hover、focus 是否一致，没有页面级复制出另一套视觉。
- 接口提交按钮 pending 是否禁用防重复、设置 `aria-busy=true`、切换 `...` 进行中文案，且保持原语义颜色。
- 禁用态是否只覆盖真实不可交互控件，且颜色走 token、没有第二套灰。
- 状态胶囊是否复用 5 类语义 tone，同一组宽高一致，没有按页面另起颜色。
- 表格是否满足表头 `#F9FBFC`、数据行透明、仅 hover `#F9FBFF`，active/selected 与 hover 语义分离。
- 列宽是否优先不滚动且视觉均衡，操作列有稳定空间并靠右，长字段通过省略/换行处理。
- 字号是否符合：主标题 24、模块标题 18、正文 13-14、辅助 11-12、指标数字不超过 34。
- 超大屏是否只扩布局不放大字号。
- 新增公共 UI 是否业务无关、已登记 `docs/ui-catalog.json`，文案与 locale 由调用方注入。
- 页面级视觉特例是否足够小，没有复制出第二套近似组件。

## 共享 UI（SSR 变体）

通用原语之外，SSR 变体额外内置一个需要 Next 路由能力的组件：

| 组件         | 位置                            | 职责                                                       |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| `LinkButton` | `src/shared/ui/link-button.tsx` | 站内链接按钮，统一 `next/link` 跳转、`hreflang` 与按钮样式 |

`LinkButton` 属于 `src/shared/ui/**`，同样受「不许 import `@/features/**`、不许调 `t()`」约束；业务页需要
站内跳转时用它，不要自己拼 `Link` + 原生 `<a>` 或换成裸 `Button` + `router.push`。
