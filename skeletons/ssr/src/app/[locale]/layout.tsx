import type { ReactNode } from 'react';

/**
 * 公开内容区布局：原样渲染子路由。
 *
 * 三件**不**在这里做的事，都有实测依据：
 *
 * 1. **不放 `dynamicParams` / `generateStaticParams`**：这两个声明只在 `[locale]/page.tsx` 上。顺带记下实测
 *    结论：`dynamicParams = false` 在这条动态路由（根 layout 读请求上下文）上**不产生路由层拒绝**，放
 *    layout 或 page 上都一样，不得把它当拒绝手段。
 * 2. **不抛 `notFound()`**：组件抛出的 `notFound()` 由 Next 内置错误边界承接，输出的文档没有
 *    `<html lang>`、没有应用样式表（应用 404 组件只剩 RSC payload）。未登记语言段的 404 由两条链承担：
 *    `src/proxy.ts` 把非法前缀改写成路由层 404（文档由根 layout + 根级 `src/app/not-found.tsx` 提供），
 *    proxy matcher 看不见的含点路径由公开页入口的 `assertPublicLocaleSegment()` 兜住。
 * 3. **不调用 `setRequestLocale()`**：`getRequestConfig` 的结果被 React `cache()` 记忆化，而根 layout
 *    位于本段之上、先于本布局渲染，子布局再设置已对本次请求无效。URL 语言由 `src/proxy.ts` 注入的
 *    `PUBLIC_LOCALE_HEADER` 提供，根 layout 的 `<html lang>` 与站点级 metadata 因而看到同一语言。
 *
 * @param props - 子路由内容。
 * @returns 子路由内容。
 */
export default async function PublicLocaleLayout({ children }: { children: ReactNode }) {
  return children;
}
