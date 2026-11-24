# Next App Router MUI Provider Example

本示例是 SSR 项目接入 MUI 的最小形态，用于生成或审查新项目时对齐 provider、Emotion cache、CSS layer 和 RSC 边界。示例默认 Next App Router，实际版本路径按项目 Next 主版本调整，例如 `v15-appRouter` 或目标版本对应路径。MUI baseline、theme token 与断点单一来源见 [`./frontend-react.md`](./frontend-react.md) 与 [`./responsive-and-breakpoints.md`](./responsive-and-breakpoints.md)。

## Dependencies

```bash
pnpm add @mui/material @emotion/react @emotion/styled @mui/material-nextjs
# 仅图标规模足够大且确认收益时再加 @mui/icons-material
```

## Provider Skeleton

> 完整 provider 接线见模板;关键约束如下。

文件分布:`src/app/layout.tsx`(挂 `<AppProviders>`) + `src/app/providers.tsx`(`'use client'`) + `src/shared/ui/theme.ts` + `src/app/globals.css`。

```tsx
// providers.tsx —— 只承载浏览器安全 provider
"use client";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "@/shared/ui/theme";

export function AppProviders({ children }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline + GlobalStyles layer 顺序 */}
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

```css
/* globals.css —— MUI 与 Tailwind 共存的 layer 顺序 */
@import "tailwindcss";
@layer theme, base, mui, components, utilities;
```

关键约束:

- `theme.ts` 用 `createTheme`,SSR 共享主题只定义稳定 token(`cssVariables`、`colorSchemes`、`borderRadius` 等),不读取 cookies、headers 或浏览器状态。
- `providers.tsx` 只承载浏览器安全 provider;服务端数据、鉴权和缓存策略留在 app/bff 边界。
- `GlobalStyles` 注入 `@layer theme, base, mui, components, utilities;`,与 `globals.css` 的 layer 声明保持一致。

## Review Checklist

- `AppRouterCacheProvider` 的 import 路径匹配项目 Next 主版本。
- `ThemeProvider` 只在统一 provider 入口挂载一次。
- Provider 不读取 server env、cookies、headers、BFF gateway 或 Node API。
- SEO 正文、metadata、缓存判断和服务端数据读取没有被整页 MUI Client Component 接管。
- MUI 与 Tailwind 共存时有 CSS layer 策略，截图无 FOUC、暗色模式闪烁和 hydration warning。
