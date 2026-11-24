/**
 * 当前骨架支持的 locale 列表，供服务端 request 配置、公开页 URL 路由与客户端切换控件共享。
 */
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;

/**
 * 无语言信号（多数爬虫、不带 `Accept-Language` 的客户端）时的兜底语言。
 *
 * 2026-10-13 项目口径（恢复 en-US）：无信号一律按英文交付，而不是按 UI 默认语言。
 * 只作用于解析链链尾——公开页 URL 语言与非公开页 cookie 都优先于它。
 *
 * 骨架**不**声明「UI 默认语言」常量：2026-10-12 至 2026-10-13 期间链尾曾回落
 * `DEFAULT_LOCALE = 'zh-CN'`，该常量已于 2026-10-13 删除（全仓无消费点，留着会被误读为兜底）。
 */
export const NO_SIGNAL_FALLBACK_LOCALE = 'en-US';

/**
 * 根路径 308 的默认公开语言 URL，同时作为公开页 hreflang 的 `x-default` 目标。
 *
 * 与 UI 默认语言无关：公开页语言由 URL 决定，这里可选一个面向自然搜索的目标语言，
 * 而不会把非公开页的无信号用户强制翻成该语言。
 */
export const DEFAULT_PUBLIC_URL_LOCALE = 'en-US';

/**
 * proxy 写入的受控 URL 语言请求头。
 *
 * 只由 `src/proxy.ts` 写入：先剥离入站值再按已登记的公开语言路由赋值，因此客户端无法伪造。
 * 它存在的唯一原因是 URL 语言必须在整棵渲染树（含根 layout 的 `<html lang>` 与站点级 metadata）可见，
 * 而 next-intl 4.x 的 `requestLocale` 不会从 `[locale]` 段参数推导。
 */
export const PUBLIC_LOCALE_HEADER = 'x-public-locale';

/**
 * 同源语言偏好 cookie 名称。公开页 URL 是语言唯一权威，cookie 只服务非公开页与跨区交接。
 */
export const LOCALE_COOKIE_NAME = 'ssr_app_locale';

/**
 * 项目支持的 locale 联合类型。
 */
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/**
 * 判断外部输入是否属于项目支持的 locale。
 *
 * @param value - cookie、header、路由段或表单传入的候选 locale。
 * @returns 输入值是否为受支持的 locale。
 */
export function isLocaleCode(value: string | undefined): value is LocaleCode {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}
