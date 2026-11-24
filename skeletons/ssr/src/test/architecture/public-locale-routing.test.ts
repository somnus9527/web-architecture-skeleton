// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PRIVATE_ROUTE_PREFIXES,
  PUBLIC_ROUTE_VISIBILITY,
  listLocalizedIndexableRoutes,
} from '@/shared/navigation/public-route-visibility';

/**
 * 公开页 locale 路由边界（静态扫描）：
 * - `app/[locale]` 只承载公开内容页，非公开区不得出现语言段；
 * - 根路径由 proxy 308 出口，不再由 `page.tsx` 提供内容；
 * - 登记表是 sitemap / robots 的唯一事实源，不得各自硬编码；
 * - URL 语言必须由 proxy 受控头注入，且入站值先被剥离；注入范围是「任意合法语言前缀」，
 *   使 404 页也按 URL 语言渲染，不随 cookie 变化；
 * - 解析链中 URL 语言优先于 cookie；
 * - 链尾是无信号兜底语言（en-US），但它压不过 URL 语言与 cookie；
 * - 未登记语言前缀由**两条链**拒绝：`src/proxy.ts` 的哨兵改写落到 routing 层 404（文档由根 layout +
 *   根级 `app/not-found.tsx` 承运，因此带 `<html lang>` 与应用样式），公开页入口的
 *   `assertPublicLocaleSegment()` 兜住 proxy matcher 看不见的含点路径。`dynamicParams = false` 在动态路由下
 *   不生效，与拒绝无关，不得复活；`experimental.globalNotFound` 不得启用（它会在构建期摘掉根 layout）。
 */
const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('../..', import.meta.url));
const ROOT_DIR = fileURLToPath(new URL('../../..', import.meta.url));
const LOCALE_SEGMENT = '[locale]';

/**
 * 读取源码文件文本。
 *
 * @param absolutePath - 文件绝对路径。
 * @returns 文件文本。
 */
function readSource(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8');
}

/**
 * 去除块注释与行注释，避免注释文本满足（或违反）源码级断言。
 *
 * @param source - 源码文本。
 * @returns 去注释后的源码文本。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * 递归收集目录下所有子目录名。
 *
 * @param dir - 起始目录。
 * @returns 目录名集合。
 */
function collectDirNames(dir: string): string[] {
  const names: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      names.push(entry.name, ...collectDirNames(`${dir}/${entry.name}`));
    }
  }

  return names;
}

/**
 * 递归收集目录下所有 `page.tsx` 绝对路径。
 *
 * @param dir - 起始目录。
 * @returns `page.tsx` 路径列表。
 */
function collectPageFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectPageFiles(child));
    } else if (entry.name === 'page.tsx') {
      files.push(child);
    }
  }

  return files;
}

describe('public locale route ownership', () => {
  it('公开页必须调用语言段守卫（proxy matcher 看不见的含点路径也要 404）', () => {
    const pages = collectPageFiles(`${APP_DIR}/${LOCALE_SEGMENT}`);

    expect(pages.length).toBeGreaterThan(0);

    for (const page of pages) {
      const source = readSource(page);
      // 含点路径（/wp-login.php、/fr.js、/xx.png）被 proxy matcher 的 `.*\..*` 排除，proxy 看不到它们，
      // 请求会直接落到公开页并渲染成 200 整页首页。必须由公开页入口的守卫兜住。
      expect(source, `公开页必须调用 assertPublicLocaleSegment: ${page}`).toContain('assertPublicLocaleSegment(');
      expect(source, `公开页必须导出 generateStaticParams: ${page}`).toContain('generateStaticParams');
      // dynamicParams = false 在动态路由（根 layout 读请求上下文）下不产生路由层拒绝，不能作为拒绝手段。
      expect(source, `不得依赖 dynamicParams 兜语言段: ${page}`).not.toContain('export const dynamicParams');
      // 组件抛出的 notFound() 统一由共享守卫调用，页面不得自己手写。
      expect(source, `公开页不得自己抛 notFound(): ${page}`).not.toContain('notFound();');
    }
  });

  it('[locale] layout 只做透传：不放 segment config、不抛 notFound()', () => {
    const layoutPath = `${APP_DIR}/${LOCALE_SEGMENT}/layout.tsx`;
    expect(existsSync(layoutPath), '缺少公开区 [locale]/layout.tsx').toBe(true);

    const layout = readSource(layoutPath);
    expect(layout).not.toContain('export const dynamicParams');
    expect(layout).not.toContain('export function generateStaticParams');
    expect(layout).not.toContain('notFound();');
  });

  it('404 统一由根级 not-found.tsx 承运，不启用 global-not-found', () => {
    const nextConfig = readSource(`${ROOT_DIR}/next.config.ts`);
    // 该开关会在构建期摘掉 /_not-found 的根 layout，让路由层 404 丢掉 <html lang> 与应用样式，不得复活。
    expect(nextConfig, '不得启用 experimental.globalNotFound').not.toContain('globalNotFound: true');
    expect(existsSync(`${APP_DIR}/global-not-found.tsx`), '不得存在 src/app/global-not-found.tsx').toBe(false);

    for (const notFoundPath of [`${APP_DIR}/not-found.tsx`, `${APP_DIR}/${LOCALE_SEGMENT}/not-found.tsx`]) {
      expect(existsSync(notFoundPath), `缺少 404 页: ${notFoundPath}`).toBe(true);

      const notFound = stripComments(readSource(notFoundPath));
      // 两份 404 都渲染在根 layout 之内：自带 <html>/<body> 会产出嵌套文档。
      expect(notFound, `404 页不得自带 <html>: ${notFoundPath}`).not.toContain('<html');
      expect(notFound, `404 页不得自带 <body>: ${notFoundPath}`).not.toContain('<body');
      expect(notFound).toContain('errors.pages.notFound');
    }

    const rootNotFound = stripComments(readSource(`${APP_DIR}/not-found.tsx`));
    expect(rootNotFound).toContain('toLocaleCode');
    // 不设 metadata 的话 404 的 <title> 会继承根 layout 的站点名，比「页面未找到」更不像 404。
    expect(rootNotFound).toContain('generateMetadata');
    // noindex 由 Next 按 404 状态码自动注入；手写 robots 会产出两条 meta。
    expect(rootNotFound).not.toContain('robots');
  });

  it('根路径不再由 page.tsx 提供内容（由 proxy 308 出口）', () => {
    expect(existsSync(`${APP_DIR}/page.tsx`), 'src/app/page.tsx 必须已迁入 [locale]').toBe(false);
  });

  it('非公开区不得出现语言段', () => {
    const nonPublicDirNames = ['(auth)', '(app)', 'ssr-app-api'].flatMap((segment) =>
      existsSync(`${APP_DIR}/${segment}`) ? collectDirNames(`${APP_DIR}/${segment}`) : [],
    );
    const localeSegments = nonPublicDirNames.filter((name) => /^\[.*locale.*\]$/i.test(name));

    expect(localeSegments).toEqual([]);
  });

  it('SEO 基建文件留在 src/app 根，不进入语言段', () => {
    for (const file of ['robots.ts', 'sitemap.ts', 'manifest.ts', 'icon.svg', 'opengraph-image.tsx']) {
      expect(existsSync(`${APP_DIR}/${file}`), `SEO 基建文件必须在根: ${file}`).toBe(true);
      expect(existsSync(`${APP_DIR}/${LOCALE_SEGMENT}/${file}`), `${file} 不得放进语言段`).toBe(false);
    }
  });
});

describe('public route visibility registry', () => {
  it('已登记的语言路由都有对应页面，且路径不含点（含点会绕过 proxy matcher）', () => {
    expect(PUBLIC_ROUTE_VISIBILITY.length).toBeGreaterThan(0);

    for (const route of PUBLIC_ROUTE_VISIBILITY) {
      expect(route.path.includes('.'), `登记路径不得含点: ${route.path}`).toBe(false);
    }

    for (const route of listLocalizedIndexableRoutes()) {
      const pageFile = route.path === '/' ? 'page.tsx' : `${route.path.replace(/^\//, '')}/page.tsx`;
      expect(existsSync(`${APP_DIR}/${LOCALE_SEGMENT}/${pageFile}`), `缺少公开页: ${route.path}`).toBe(true);
    }
  });

  it('私有路由前缀覆盖 non-public 三区，且不含语言前缀', () => {
    for (const prefix of ['/login', '/showcase-console', '/ssr-app-api/']) {
      expect(PRIVATE_ROUTE_PREFIXES, `缺少私有前缀: ${prefix}`).toContain(prefix);
    }

    expect(PRIVATE_ROUTE_PREFIXES.some((item) => /-(CN|US)\/?$/.test(item))).toBe(false);
  });

  it('sitemap 与 robots 由登记表派生，不各自硬编码路径', () => {
    const sitemap = readSource(`${APP_DIR}/sitemap.ts`);
    const robots = readSource(`${APP_DIR}/robots.ts`);

    expect(sitemap).toContain('listLocalizedIndexableRoutes');
    expect(sitemap).toContain('buildHreflangLanguages');
    expect(robots).toContain('PRIVATE_ROUTE_PREFIXES');
    expect(robots).not.toContain("'/ssr-app-api/'");
  });
});

describe('url locale plumbing', () => {
  it('proxy 注入受控 URL 语言头并剥离入站值', () => {
    const proxy = readSource(`${SRC_DIR}/proxy.ts`);

    expect(proxy).toContain('PUBLIC_LOCALE_HEADER');
    expect(proxy).toContain('forwardedHeaders.delete(PUBLIC_LOCALE_HEADER)');
    // 注入范围只看合法语言前缀：404 页也要按 URL 语言渲染，不得被登记表收窄。
    expect(proxy).toContain('resolveUrlLocale');
    expect(proxy).not.toContain('resolveLocalizedPublicLocale');
    expect(proxy).toContain('308');
  });

  it('proxy 把非法语言前缀改写成路由层 404（dynamicParams 拦不住这类请求）', () => {
    const proxy = readSource(`${SRC_DIR}/proxy.ts`);

    expect(proxy).toContain('createUnknownLocaleRejection');
    expect(proxy).toContain('UNKNOWN_LOCALE_SENTINEL');
    expect(proxy).toContain('PRIVATE_ROUTE_PREFIXES');
    expect(proxy).toContain('isLocaleCode');
    // 只有匹配不到路由的请求才走路由层文档（根 layout + 根 not-found）；抛 notFound() 得到内置错误文档。
    expect(proxy).not.toContain('notFound();');
  });

  it('proxy 只放行 `_next` 内部段，不放行任意 `_` 前缀路径', () => {
    const proxy = readSource(`${SRC_DIR}/proxy.ts`);

    expect(proxy).toContain("NEXT_INTERNAL_SEGMENT = '_next'");
    // 放宽成「所有 `_` 前缀」会让 /_foo、/__foo 被 [locale] 匹配并渲染成 200 整页首页。
    expect(proxy).not.toContain("startsWith('_')");
  });

  it('解析链中 URL 语言优先于 cookie，链尾为无信号兜底语言', () => {
    const request = readSource(`${SRC_DIR}/i18n/request.ts`);
    const localeConfig = readSource(`${SRC_DIR}/i18n/locale-config.ts`);

    const urlReadIndex = request.indexOf('headersList.get(PUBLIC_LOCALE_HEADER)');
    const cookieReadIndex = request.indexOf('await cookies()');
    expect(urlReadIndex).toBeGreaterThan(-1);
    expect(cookieReadIndex).toBeGreaterThan(urlReadIndex);

    expect(localeConfig).toContain('NO_SIGNAL_FALLBACK_LOCALE');
    expect(localeConfig).toContain('DEFAULT_PUBLIC_URL_LOCALE');
    expect(localeConfig).toContain('PUBLIC_LOCALE_HEADER');
    // 链尾必须消费无信号兜底常量（en-US）；UI 默认语言常量已于 2026-10-13 删除，不得复活。
    expect(request).toContain('NO_SIGNAL_FALLBACK_LOCALE');
    expect(request).not.toContain('DEFAULT_LOCALE');
    expect(localeConfig).not.toMatch(/export const DEFAULT_LOCALE\b/);
  });

  it('根 layout 不硬编码 openGraph.locale（由公开页按 URL 语言提供）', () => {
    expect(readSource(`${APP_DIR}/layout.tsx`)).not.toContain("locale: 'en_US'");
  });
});
