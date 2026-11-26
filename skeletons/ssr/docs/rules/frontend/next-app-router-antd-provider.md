# Next App Router Ant Design Provider Example

本示例是 SSR 项目接入 Ant Design 6 的最小形态，用于生成或审查新项目时对齐 provider、`AntdRegistry`、RSC 边界和样式抽取。antd baseline、token 与断点单一来源见 [`./frontend-react.md`](./frontend-react.md)、[`./native-css-and-tokens.md`](./native-css-and-tokens.md) 与 [`./responsive-and-breakpoints.md`](./responsive-and-breakpoints.md)。

## Dependencies

```bash
pnpm add antd lucide-react @ant-design/nextjs-registry
# 不要安装 @mui/*、@emotion/*、tailwindcss 或 @tailwindcss/*
```

## Provider Skeleton

文件分布：`src/app/layout.tsx`（挂 `<AppProviders>`）+ `src/app/providers.tsx`（`'use client'`）+ `src/shared/theme/antd-theme.ts` + `src/app/globals.css`。

```tsx
// providers.tsx —— 只承载浏览器安全 provider
'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider } from 'antd';
import { antdTheme } from '@/shared/theme/antd-theme';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
```

```css
/* globals.css —— 不使用 Tailwind */
@import '../shared/theme/tokens.css';
@import '../shared/ui/ui.css';
@import './app.css';
```

关键约束：

- `antd-theme.ts` 只定义稳定 token（颜色、圆角、字体、组件默认值），不读取 cookies、headers 或浏览器状态。
- `providers.tsx` 只承载浏览器安全 provider；服务端数据、鉴权和缓存策略留在 app/bff 边界。
- `AntdRegistry` 必须在根 layout 的 provider 链里，否则 SSR 首屏样式可能缺失。
- 不要启用 `zeroRuntime`，除非项目已经接入静态样式抽取并验证主题覆盖；默认使用 antd v6 的 CSS-in-JS + CSS 变量。
- `message` / `notification` / `modal` 通过 `App.useApp()` 获取，不调用静态方法。

## Review Checklist

- 依赖只有 `antd`、`lucide-react`、`@ant-design/nextjs-registry`；无 MUI/Emotion/Tailwind。
- `AntdRegistry` 和 `ConfigProvider` 只在统一 provider 入口挂载一次。
- `App` provider 包裹 `children`，使 feedback/context 可用。
- Provider 不读取 server env、cookies、headers、BFF gateway 或 Node API。
- SEO 正文、metadata、缓存判断和服务端数据读取没有被整页 antd Client Component 接管。
- 首屏无 FOUC、无重复主题 CSS 变量类、无 hydration warning。
