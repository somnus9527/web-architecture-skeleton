import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { ITraceContext } from '@/shared/trace/trace-context';

import { DEFAULT_PUBLIC_URL_LOCALE, PUBLIC_LOCALE_HEADER, isLocaleCode } from '@/i18n/locale-config';
import { readAllowedOrigin } from '@/shared/config/edge-env';
import { resolveUrlLocale } from '@/shared/i18n/public-locale-routing';
import { PRIVATE_ROUTE_PREFIXES } from '@/shared/navigation/public-route-visibility';
import { buildContentSecurityPolicy } from '@/shared/security/content-security-policy';
import { resolveTraceContext } from '@/shared/trace/trace-context';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'content-type, x-request-id, x-trace-id, traceparent';

/** 把 nonce 透传给 RSC/客户端读取的请求头；Next 也会从响应 CSP 中解析同一个 nonce。 */
const NONCE_HEADER = 'x-nonce';

/** 根路径 308 响应的缓存时长（秒）；不用 immutable，保留调整默认公开语言的余地。 */
const ROOT_REDIRECT_MAX_AGE = 3600;

/**
 * 非法语言前缀被改写到 `pathname + '/' + 本段`，用来制造「匹配不到任何路由」的路由层 404。
 *
 * 不能改写到单段路径：`[locale]` 会匹配任意单段，那样反而渲染成公开页。
 */
const UNKNOWN_LOCALE_SENTINEL = '__unknown-locale';

/**
 * Next 内部路径的顶层段（`/_next/static`、`/_next/image`、`/_next/data` 等），必须放行。
 *
 * 只放行这一个段，**不得**放宽成「所有 `_` 前缀」：`/_foo`、`/__foo` 不是内部路由，会被 `[locale]`
 * 匹配成语言段并渲染出 200 + 整页首页（实测 Next 16.2 standalone 生产构建，是软 404）。
 */
const NEXT_INTERNAL_SEGMENT = '_next';

/**
 * 不以语言段开头、但确实是真实路由的顶层段。
 *
 * `PRIVATE_ROUTE_PREFIXES` 是私有区的唯一事实源（登记表见
 * `src/shared/navigation/public-route-visibility.ts`）；`/opengraph-image` 是站点级 metadata 路由，
 * 它不含点，因此不会被 matcher 的 `.*\..*` 排除，必须显式列出，否则会被误判成非法语言前缀。
 */
const NON_LOCALE_TOP_LEVEL_SEGMENTS = [
  ...PRIVATE_ROUTE_PREFIXES.map((prefix) => prefix.replace(/\/$/, '')).filter(Boolean),
  '/opengraph-image',
];

/**
 * Next.js 16 Proxy 入口，集中处理根路径语言跳转、非法语言前缀拒绝、URL 语言镜像头、安全响应头与最小
 * CORS allowlist。
 *
 * @param request - 进入 App Router 前的请求对象。
 * @returns 带安全头的响应、根路径重定向、非法语言前缀的 404 改写或 CORS 预检响应。
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const trace = resolveTraceContext(request.headers);

  if (request.method === 'OPTIONS') {
    return createCorsPreflightResponse(request, nonce, trace);
  }

  const rootRedirect = createRootRedirect(request, nonce, trace);
  if (rootRedirect) {
    return rootRedirect;
  }

  const unknownLocaleRejection = createUnknownLocaleRejection(request, nonce, trace);
  if (unknownLocaleRejection) {
    return unknownLocaleRejection;
  }

  const response = NextResponse.next({ request: { headers: buildForwardedRequestHeaders(request, nonce, trace) } });
  applySecurityHeaders(response, request, nonce, trace);
  applyCorsHeaders(response, request);
  return response;
}

/**
 * 生成每请求一次的 CSP nonce。
 *
 * 用 `crypto.randomUUID()` 而不是 Node 的 `randomBytes`：这段代码运行在 Edge runtime，没有 Node API；
 * UUID v4 的随机性对本用途足够，且两个 UUID 去掉横线后仍是合法的 base64 字符集。
 *
 * @returns 32 位十六进制字符串形式的 nonce。
 */
function createNonce(): string {
  return crypto.randomUUID().replace(/-/gu, '');
}

/**
 * 拒绝非法语言前缀：把请求改写成「一定匹配不到路由」的路径，让 Next 走**路由层** 404。
 *
 * 为什么必须在 proxy 里做，而不是在 `[locale]` 里补校验（实测于 Next 16.2）：
 *
 * - `dynamicParams = false` 不拦这类请求。`/[locale]` 因为根 layout 读取请求上下文而是**动态路由**，
 *   Next 不会为它产出静态路径/fallback 表，于是 `/fr` 直接渲染公开首页并返回 **200**（语言退化成
 *   cookie / 浏览器语言）。放在 layout 或 page 上都不生效。
 * - 组件抛出的 `notFound()` 能给出 404，但文档由 Next 内置错误边界产出：没有 `<html lang>`、没有应用
 *   样式表，应用 404 组件只剩 RSC payload。
 *
 * 只有「匹配不到路由」的 404 才会渲染根级 `src/app/not-found.tsx`（套在根 layout 内，因此 `<html lang>`、
 * 应用样式与自动 `noindex` 都在）——这是它与「组件抛 `notFound()`」那条链的关键差别，也是本改写唯一的
 * 改写目标：不是把带前缀地址映射到无前缀目录，而是让一个不该存在的内容 URL 落回 404。
 *
 * **本函数覆盖不到的路径**：含点路径（`/wp-login.php`、`/fr.js`、`/xx.png`）被 matcher 的 `.*\..*` 整段
 * 排除，proxy 根本收不到；它们由公开页入口的 `assertPublicLocaleSegment()` 拒掉（状态码正确，文档退化成
 * Next 内置错误壳）。放宽 matcher 不是选项：`public/` 下的静态资源一旦漏登记就会被改写成 404。
 *
 * 改写保持原路径形状并追加哨兵段，因此 `usePathname()` 在服务端与客户端一致；`PUBLIC_LOCALE_HEADER` 由
 * `buildForwardedRequestHeaders` 决定（非法前缀不注入），`<html lang>` 因而按 cookie → `Accept-Language`
 * → `en-US` 解析。哨兵段同时充当幂等标记：改写后的请求即使再次经过 proxy 也不会二次追加。
 *
 * @param request - 当前请求。
 * @returns 改写响应；路径首段是合法语言码、`_next` 内部路径或真实非语言路由时返回 undefined。
 */
function createUnknownLocaleRejection(
  request: NextRequest,
  nonce: string,
  trace: ITraceContext,
): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const [firstSegment] = pathname.split('/').filter(Boolean);

  if (!firstSegment || firstSegment === NEXT_INTERNAL_SEGMENT || isLocaleCode(firstSegment)) {
    return undefined;
  }

  if (NON_LOCALE_TOP_LEVEL_SEGMENTS.includes(`/${firstSegment}`)) {
    return undefined;
  }

  if (pathname.endsWith(`/${UNKNOWN_LOCALE_SENTINEL}`)) {
    return undefined;
  }

  const target = new URL(
    `${pathname.replace(/\/$/, '')}/${UNKNOWN_LOCALE_SENTINEL}${request.nextUrl.search}`,
    request.url,
  );
  const response = NextResponse.rewrite(target, {
    request: { headers: buildForwardedRequestHeaders(request, nonce, trace) },
  });
  applySecurityHeaders(response, request, nonce, trace);
  return response;
}

/**
 * 根路径 308 到默认公开语言 URL，保留 query。
 *
 * URL 是公开页语言的唯一权威，因此这里不做基于 cookie / Accept-Language 的动态跳转——
 * 那会让爬虫与用户看到不同目标语言，削弱多语言信号的合并。
 *
 * @param request - 当前请求。
 * @returns 重定向响应；非根路径或非 GET/HEAD 时返回 undefined。
 */
function createRootRedirect(request: NextRequest, nonce: string, trace: ITraceContext): NextResponse | undefined {
  if (request.nextUrl.pathname !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return undefined;
  }

  const target = new URL(`/${DEFAULT_PUBLIC_URL_LOCALE}${request.nextUrl.search}`, request.url);
  const response = NextResponse.redirect(target, 308);
  response.headers.set('Cache-Control', `public, max-age=${ROOT_REDIRECT_MAX_AGE}`);
  applySecurityHeaders(response, request, nonce, trace);
  return response;
}

/**
 * 构造转发给服务端渲染的请求头。
 *
 * 受控 URL 语言头先无条件剥离入站值（客户端不可伪造），再在首段是受支持语言码时赋值；**不限于已登记的
 * 公开路径**——404 页（`/en-US/<未登记>`、`/zh-CN/login`）同样属于公开语言前缀下的渲染结果，必须按 URL
 * 语言输出，否则同一个 URL 会随 cookie 变成另一种语言。路径是否可访问由 `createUnknownLocaleRejection`
 * 与路由树共同决定，与该头无关。
 *
 * next-intl 4.x 不会从 `[locale]` 段参数推导 locale，且根 layout 位于该段之上，因此这是让整棵渲染树
 * 看到同一 URL 语言的唯一位置。
 *
 * @param request - 当前请求。
 * @returns 转发给 RSC / Route Handler 的请求头。
 */
function buildForwardedRequestHeaders(request: NextRequest, nonce: string, trace: ITraceContext): Headers {
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete(PUBLIC_LOCALE_HEADER);
  forwardedHeaders.set(NONCE_HEADER, nonce);
  forwardedHeaders.set('X-Request-Id', trace.requestId);
  forwardedHeaders.set('traceparent', trace.traceparent);
  if (trace.tracestate) {
    forwardedHeaders.set('tracestate', trace.tracestate);
  } else {
    forwardedHeaders.delete('tracestate');
  }
  // 入站 tlogTraceId 只可能是伪造或上一跳残留，统一剥离，后端才是唯一来源。
  forwardedHeaders.delete('tlogTraceId');
  forwardedHeaders.delete('X-TLog-Trace-Id');
  forwardedHeaders.delete('x-trace-id');

  const urlLocale = resolveUrlLocale(request.nextUrl.pathname);
  if (urlLocale) {
    forwardedHeaders.set(PUBLIC_LOCALE_HEADER, urlLocale);
  }

  return forwardedHeaders;
}

/**
 * 创建 CORS 预检响应，只允许配置中的明确 origin。
 *
 * @param request - 当前预检请求。
 * @returns 允许或拒绝的预检响应。
 */
function createCorsPreflightResponse(request: NextRequest, nonce: string, trace: ITraceContext): NextResponse {
  const response = new NextResponse(null, { status: isAllowedOrigin(request) ? 204 : 403 });
  applySecurityHeaders(response, request, nonce, trace);
  applyCorsHeaders(response, request);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/**
 * 写入安全响应头，覆盖公开页与 Route Handler 的基础浏览器防护。
 *
 * @param response - 待返回的 NextResponse。
 * @param request - 当前请求，用于判断是否写入 HSTS。
 */
function applySecurityHeaders(response: NextResponse, request: NextRequest, nonce: string, trace: ITraceContext): void {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy({ nonce }));
  response.headers.set('X-Request-Id', trace.requestId);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/**
 * 写入 CORS header；无 Origin 的同源导航请求不额外展开跨域能力。
 *
 * @param response - 待返回的 NextResponse。
 * @param request - 当前请求。
 */
function applyCorsHeaders(response: NextResponse, request: NextRequest): void {
  const origin = request.headers.get('origin');
  response.headers.append('Vary', 'Origin');

  if (!origin || !isAllowedOrigin(request)) {
    return;
  }

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '600');
}

/**
 * 判断请求 Origin 是否命中当前环境允许的同源 origin。
 *
 * @param request - 当前请求。
 * @returns Origin 是否允许跨域访问。
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const allowedOrigin = readAllowedOrigin();
  return origin === allowedOrigin;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
