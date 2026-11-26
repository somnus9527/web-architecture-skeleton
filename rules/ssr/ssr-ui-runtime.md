# SSR UI Runtime

## Scope

本规范定义 Next.js App Router SSR 项目里的 UI 运行时边界，覆盖 Ant Design 6、`AntdRegistry`、`ConfigProvider`、原生 CSS 变量、暗色模式、图标依赖和可视化验收。RSC 规则见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)，bundle / hydration 规则见 [`./ssr-cache-and-performance.md`](./ssr-cache-and-performance.md)。

## Ant Design SSR Positioning

- 新 SSR 项目使用 `antd` 6.x、`lucide-react` 和 `@ant-design/nextjs-registry`；antd 内部图标由 antd 自己维护，不作为业务直接依赖。
- antd 组件按 SSR-compatible Client Component 交互体系处理，不作为承载服务端数据访问、metadata 或缓存决策的 Server Component primitive。
- 业务代码只从 `@/shared/ui` 导入 UI；antd 直接 import 只允许出现在 `src/shared/ui/**`、`src/shared/theme/antd-theme.ts` 和 `src/app/providers.tsx`。
- 既有项目迁移时，先冻结新增 MUI/Tailwind，再按页面替换；不要在同一页面混用两套组件库。

## Provider Baseline

- 根 layout 或 app provider 必须挂 `AntdRegistry`，确保首屏样式被抽取；`ConfigProvider` 只挂一次。
- `ThemeConfig` 来自 `src/shared/theme/antd-theme.ts`；token 源值来自 `design-tokens.ts`。
- Provider 入口可以是 Client Component，但只承载样式、主题、locale UI provider、feedback provider 等浏览器安全上下文，不读取 server secret、cookies、headers 或 BFF-only helper。
- `src/app/layout.tsx` 负责装配 provider 和全局样式；服务端数据读取、metadata、鉴权和缓存策略仍由 Server Component / BFF 管理。
- 最小可复制示例放在 `next-app-router-antd-provider.md`。

## RSC And UI Boundaries

- antd-heavy UI 应下沉到 `src/features` 的叶子 Client Component；`page.tsx` / `layout.tsx` 保持服务端数据读取、metadata、鉴权和缓存策略职责，再把最小 view model 传入 UI。
- 公开 SEO 内容页不应为了少量交互把整页包成 antd client subtree；正文、metadata 和可索引内容优先保留 Server Component 渲染，筛选、表单、弹窗、反馈等交互再用 Client Component。
- Server Component 传入 Client Component 的 props 必须是 JSON 可序列化 view model，不传后端 raw DTO、token、权限全集、错误堆栈或审计字段。
- antd `Modal`、`Drawer`、`Table`、`Tabs` 等交互组件按 feature 归属放置；跨业务通用包装才放 `src/shared/ui`。

## CSS And Theme

- 应用样式使用原生 CSS + `src/shared/theme/tokens.css` 的 CSS 变量；不使用 Tailwind。
- antd 组件内部样式由 antd 负责；业务 CSS 不依赖 `.ant-*` 内部类做布局，需要覆盖时用公开 `className` 加自己的语义类。
- 不要把 CSS 变量字符串传进 antd seed token；antd 的颜色算法需要具体值。TS 与 CSS 同源，但不要互相传值。
- 暗色模式、系统主题和首屏主题状态不得通过 hydration 后再纠正的方式造成闪烁；第一版只启用 light，dark 等验证后再开。
- 出现 FOUC、重复主题 CSS 变量类或 hydration warning 时，先审计 `AntdRegistry`、`ConfigProvider` 位置和 provider 嵌套，不把页面整体改为 CSR。

## Bundle Rules

- antd 按需直接导入；icons 按需直接导入；禁止从项目级 UI barrel 一次性 re-export 大量 icons/theme helper 到性能敏感路径。
- 不对 `antd` 做全量 `import * as antd`；不要把整个 `lucide-react` 包挂到页面；业务图标从 `@/shared/ui` 的图标 facade 按需导入。
- 大型 UI/icon 包变更后 handoff 附 chunk 证据或未验证风险。

## Verification

> 交付校验见 [`./ssr-verification.md`](./ssr-verification.md)；UI 运行时专项至少覆盖：根 provider 含 `AntdRegistry`、`ConfigProvider` 未重复挂载、antd-heavy UI 未接管公开 SEO 整页、无 Tailwind/MUI import、首屏无样式闪烁、无 hydration warning、antd icon/chunk 体积风险已评估。

- Handoff 必须列出 antd/icons/registry 版本、provider 入口、`ConfigProvider` 位置、token 来源、client leaf 边界、兼容例外和未验证风险。
