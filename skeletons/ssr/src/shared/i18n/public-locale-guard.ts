import 'server-only';

import { notFound } from 'next/navigation';

import { isLocaleCode } from '@/i18n/locale-config';

/**
 * 校验公开页 URL 语言段：不是受支持语言的段一律 404。
 *
 * **为什么 `src/proxy.ts` 的非法前缀拒绝之外还需要它**：proxy 只能处理 matcher 看得见的请求。matcher
 * `'/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'` 排除了含点路径，而 `[locale]` 会匹配任意
 * **单段**，于是 `/wp-login.php`、`/fr.js`、`/xx.png` 这类请求直接落到公开页，被渲染成 **200 + 整页首页**
 * （Next 16.2 standalone 生产构建实测，是典型的软 404 / 重复内容）。`dynamicParams = false` 拦不住它们：
 * `/[locale]` 因根 layout 读取请求上下文而是动态路由，Next 不为它产出静态路径 / fallback 表。
 *
 * **代价（已知并接受）**：组件抛出的 `notFound()` 由 Next 内置错误边界承接，这类 404 的文档是内置错误壳
 * （`<html id="__next_error__">`：无 `<html lang>`、无应用样式表，服务端 body 为空），而不是路由层 404
 * 那份完整的根 layout + `src/app/not-found.tsx` 文档；状态码与索引指令（404 + `noindex`）仍然正确，
 * 受影响的是 UX / a11y / 审计工具。
 *
 * 走这条路是因为**没有更好的选项**（Next 16.2 standalone 生产构建实测）：给它加 Suspense 边界（如
 * `[locale]/loading.tsx`）确实能保住 app shell 文档，但状态码会退化成 **200**——软 404 比错误壳更糟。
 * 两条拒绝链因此必须同时存在：proxy 的路由层拒绝负责「看得见的请求」的文档质量（那份 404 是服务端直出、
 * 带 `lang` 与样式），本守卫用状态码正确性兜住「matcher 之外」的完整性。
 *
 * 每个公开页都必须在渲染入口调用一次，由
 * `src/test/architecture/public-locale-routing.test.ts` 静态扫描强制。
 *
 * @param urlLocale - `[locale]` 段值。
 */
export function assertPublicLocaleSegment(urlLocale: string): void {
  if (!isLocaleCode(urlLocale)) {
    notFound();
  }
}
