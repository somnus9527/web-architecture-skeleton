# SSR UI Runtime

## Scope

本规范定义 Next.js App Router SSR 项目里的 UI 运行时边界，覆盖 MUI、Emotion/cache provider、ThemeProvider、Tailwind CSS layer、暗色模式、图标依赖和可视化验收。RSC 规则见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)，bundle / hydration 规则见 [`./ssr-cache-and-performance.md`](./ssr-cache-and-performance.md)。

## MUI SSR Positioning

- MUI 支持 SSR，但 MUI / MUI System 组件在当前基线下按 SSR-compatible Client Component 交互体系处理，不把 MUI 组件当作可承载服务端数据访问、metadata 或缓存决策的 Server Component primitive。
- 新 SSR 项目采用 MUI 时默认依赖 `@mui/material`、`@emotion/react`、`@emotion/styled` 和匹配 Next 主版本的 `@mui/material-nextjs`。
- `@mui/icons-material` 只在确有图标规模收益时引入；少量业务图标优先使用项目既有图标库或 `lucide`。
- 既有项目如果已有可 SSR 的设计系统，MUI 迁移只适用于新能力或 parity-safe 区域；复杂既有视觉面可记录 `compatible-exception`，但仍要满足 RSC、缓存、契约和安全边界。

## Provider Baseline

- 根 layout 或 app provider 必须使用与 Next 主版本匹配的 `@mui/material-nextjs/*-appRouter` `AppRouterCacheProvider`，避免 Emotion 样式只注入 body 或 streaming 时样式顺序错误。
- MUI `ThemeProvider` 只在统一 provider 入口挂载一次；不要在普通 feature 组件或 route segment 内重复创建 theme、font 或 Emotion cache。
- Provider 入口可以是 Client Component，但必须只承载样式、主题、locale UI provider、feedback provider 等浏览器安全上下文，不读取 server secret、cookies、headers 或 BFF-only helper。
- `src/app/layout.tsx` 负责装配 provider 和全局样式；服务端数据读取、metadata、鉴权和缓存策略仍由 Server Component / BFF 管理。
- 最小可复制示例放在 `next-app-router-mui-provider.md`；生成新 SSR 项目时优先复用该形态，再按目标项目调整。

## RSC And UI Boundaries

- MUI-heavy UI 应下沉到 `src/features` 的叶子 Client Component；`page.tsx` / `layout.tsx` 保持服务端数据读取、metadata、鉴权和缓存策略职责，再把最小 view model 传入 MUI UI。
- 公开 SEO 内容页不应为了少量交互把整页包成 MUI client subtree；正文、metadata 和可索引内容优先保留 Server Component 渲染，筛选、表单、弹窗、反馈等交互再用 MUI Client Component。
- Server Component 传入 MUI Client Component 的 props 必须是 JSON 可序列化 view model，不传后端 raw DTO、token、权限全集、错误堆栈或审计字段。
- MUI Dialog、Drawer、Snackbar、表单、Table、Tabs 等交互组件按 feature 归属放置；跨业务通用包装才放 `src/shared/ui`。

## CSS Layer And Tailwind

- MUI 与 Tailwind v4 并存时，必须启用明确 CSS layer 策略，例如 `AppRouterCacheProvider` 的 `enableCssLayer`、MUI modular CSS layers 或项目等价方案。
- Tailwind v4 只作为 utility styling、布局支持或 legacy-template 兼容，不重新实现 MUI 已提供交互和可访问性行为的组件。
- 样式优先级异常不得通过重复 `!important`、组件内临时 `<style>` 或偶然 import 顺序处理。
- CSS 通过 global import、CSS Modules、MUI `sx` / styled API 或项目样式系统进入 Next 构建；不要在组件里手写本地 CSS `<link>`。

## Theme And Hydration

- 暗色模式、系统主题和首屏主题状态不得通过 hydration 后再纠正的方式造成闪烁；优先使用 MUI CSS variables、`theme.applyStyles()` 或项目等价 SSR-safe 主题策略。
- MUI 主题、颜色模式、media query 和 responsive 分支必须避免服务端与客户端初始值不一致；需要依赖浏览器状态时使用 SSR-safe 默认值、CSS variables 或延后到局部 Client Component。
- 字体初始化仍按 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md) 执行：使用 `next/font` 或项目既有字体方案，只在 layout 或共享字体模块初始化一次。
- 出现 FOUC、Emotion style 顺序错误或 Tailwind layer 覆盖异常时，先审计 `AppRouterCacheProvider`、ThemeProvider 位置、CSS layer 和 provider 嵌套，不把页面整体改为 CSR。

## Bundle Rules

- MUI 项目优先使用稳定的直接导入或 `optimizePackageImports`，icons 按需直接导入；禁止从项目级 UI barrel 一次性 re-export 大量 MUI 组件/icons/theme helper 到性能敏感路径，也不为少量图标引入整套 icon bundle。

> 重组件懒加载、`next/dynamic`、bundle analyzer/chunk 摘要等通用 bundle 约束按 [`./ssr-cache-and-performance.md`](./ssr-cache-and-performance.md) 行业标准执行；大型 UI/icon 包变更后 handoff 附 chunk 证据或未验证风险。

## Verification

> 交付校验见 [`./ssr-verification.md`](./ssr-verification.md)；UI 运行时专项至少覆盖：根 provider 含 `AppRouterCacheProvider`、ThemeProvider 未重复挂载、MUI-heavy UI 未接管公开 SEO 整页、CSS layer 配置存在且无重复 `!important`/临时 `<style>`、首屏与暗色模式无样式闪烁、无 hydration warning、MUI icon/chunk 体积风险已评估。

- Handoff 必须列出 MUI/Emotion 依赖、`@mui/material-nextjs` 版本路径、provider 入口、ThemeProvider 位置、CSS layer 策略、client leaf 边界、兼容例外和未验证风险。
