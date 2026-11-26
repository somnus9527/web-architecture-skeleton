# Native CSS And Design Tokens

## Scope

- 所有 SPA/SSR 页面、布局、面板、表格容器和自建组件使用原生 CSS + CSS 变量。
- 不引入 Tailwind CSS：不安装 `tailwindcss` / `@tailwindcss/*`，不写 utility class，不用 `@apply`。
- Ant Design 只负责交互组件；应用层样式、布局和品牌 token 由本项目 CSS 负责。

## Token Source

- 唯一源值：`src/shared/theme/design-tokens.ts`。
- 对外 CSS 变量：`src/shared/theme/tokens.css`，变量值必须与 TS 源值保持一致。
- antd 主题：`src/shared/theme/antd-theme.ts`，只从这里读取 token，不新建第二套 theme。
- 业务页面不写 hex 色值、字号、圆角、间距常量；使用 `var(--color-*)`、`var(--space-*)`、`var(--radius-*)`、`var(--font-size-*)`。
- 新增 token 先加 TS 源值，再补 `tokens.css`，最后才允许页面使用。

## Naming

- 颜色用语义名：`--color-primary`、`--color-bg`、`--color-surface`、`--color-text`、`--color-text-muted`、`--color-border`、`--color-danger`、`--color-success`、`--color-warning`。
- 间距用 `--space-1/2/3/4/6/8`，不要新增 `--space-5` 等零散值；需要新档位先改 token。
- 圆角用 `--radius-sm/md/lg/full`；字体用 `--font-sans` 与 `--font-size-*`。
- 自建组件 class 使用 `aui-` 前缀，页面布局使用语义块名（如 `.app-shell`、`.dashboard`、`.order-row`），不按颜色命名（禁止 `.blue-button`）。

## CSS Entry

- SPA：`src/styles.css` 依次 import `tokens.css`、`shared/ui/ui.css`、页面样式。
- SSR：`src/app/globals.css` 依次 import `tokens.css`、`shared/ui/ui.css`、页面样式。
- 不要在每个组件里写 `<style>` 或动态注入全局样式；共享 UI 的样式集中在 `shared/ui/ui.css`。
- 页面级 CSS 只放页面布局和本页语义块，不复制共享组件的视觉规则。

## Ant Design Integration

- `ConfigProvider theme={antdTheme}` 只挂一次；不要给单个组件包第二层 `ConfigProvider`。
- 不要用 antd 内部 class（`.ant-*`）做业务布局；需要覆盖时用组件公开的 `className` 加自己的语义类。
- 不要给 antd seed token 传 `var(--...)`；antd 的颜色算法需要具体值。应用 CSS 变量与 antd token 同源，但不要互相传值。
- `message` / `notification` / `modal` 统一通过 `App.useApp()`，不要用静态方法。
- 复杂组件（Table、Modal、Select）由 `@/shared/ui` 统一出口或薄封装；业务不直接 import `antd`。

## Theme

- 第一版只启用 light；`tokens.css` 可以预留 `[data-theme='dark']`，但不要在未验证 SSR 首屏/闪烁前启用。
- 暗色/多品牌只通过 token 覆盖，不复制组件样式。
- 系统主题、语言字体切换必须 SSR-safe；不要在模块顶层读取 `window`。

## Breakpoints

- 断点值来自 `designTokens.breakpoints`，CSS 使用 `@media (min-width: ...)` 的语义值。
- 不使用 Tailwind 默认 `sm/md/lg/xl`；不新增零散断点，先改 token。
- 超大屏只扩布局（列数、容器宽度、图表空间），不放大控制台字号。

## Review Checklist

- 没有 Tailwind 依赖、`@import 'tailwindcss'` 或 utility class。
- 没有页面级 hex 色值/字号/圆角常量。
- 新 token 同时存在于 `design-tokens.ts` 与 `tokens.css`。
- 共享 UI 样式只在 `shared/ui/ui.css`，页面 CSS 没有复制一套按钮/输入框/状态胶囊。
- SSR 首屏样式由 `AntdRegistry` 抽取，无 FOUC、无重复主题 CSS 变量类。
