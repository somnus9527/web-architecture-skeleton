#!/usr/bin/env node
/**
 * 公开页 SEO / 多语言路由静态检查（pre-commit 可运行，不启动 Next）。
 *
 * 用法：
 *   node scripts/check-seo-routing.mjs --staged
 *   node scripts/check-seo-routing.mjs --tracked
 *   node scripts/check-seo-routing.mjs --files src/app/[locale]/page.tsx
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const APP_DIR = join(process.cwd(), 'src', 'app');
const SRC_DIR = join(process.cwd(), 'src');
const REGISTRY = join(SRC_DIR, 'shared', 'navigation', 'public-route-visibility.json');
const RELEVANT = /^(?:src\/(?:app|proxy\.ts|i18n|shared\/(?:seo|i18n|navigation))|next\.config\.ts)/u;
const failures = [];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^[ \t]*\/\/.*$/gmu, '');
}

function fail(message) {
  failures.push(message);
}

function listFiles(mode) {
  if (mode === 'tracked') {
    return git(['ls-files']).split('\n').filter(Boolean);
  }
  if (mode === 'staged') {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  }
  const index = process.argv.indexOf('--files');
  return index >= 0 ? process.argv.slice(index + 1) : [];
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

function pageForRoute(routePath) {
  return join(APP_DIR, '[locale]', routePath === '/' ? 'page.tsx' : `${routePath.replace(/^\//u, '')}/page.tsx`);
}

function checkPage(file, registryRoutes) {
  const source = stripComments(read(file));
  const relative = normalizePath(file).slice(process.cwd().length + 1);
  if (!source.includes('assertPublicLocaleSegment(')) fail(`${relative}: 缺少 assertPublicLocaleSegment()`);
  if (!source.includes('generateStaticParams')) fail(`${relative}: 缺少 generateStaticParams()`);
  if (!source.includes('generateMetadata') && !source.includes('export const metadata')) {
    fail(`${relative}: 缺少 generateMetadata/metadata`);
  }
  if (source.includes('notFound();')) fail(`${relative}: 不得自己抛 notFound()`);
  if (source.includes('export const dynamicParams')) fail(`${relative}: 不得依赖 dynamicParams`);
  if (source.includes('generateMetadata')) {
    if (!source.includes('buildPublicAlternates'))
      fail(`${relative}: generateMetadata 必须使用 buildPublicAlternates()`);
    if (!source.includes('buildPublicOpenGraph')) fail(`${relative}: generateMetadata 必须使用 buildPublicOpenGraph()`);
  }

  const routePath = relative.includes('[locale]/page.tsx')
    ? '/'
    : `/${relative.split('[locale]/')[1].replace(/\/page\.tsx$/u, '')}`;
  if (!registryRoutes.some((route) => route.path === routePath)) {
    fail(`${relative}: 未登记到 public-route-visibility.json`);
  }
}

function checkFiles() {
  if (!existsSync(REGISTRY)) {
    fail('缺少 src/shared/navigation/public-route-visibility.json');
    return;
  }

  const registry = JSON.parse(read(REGISTRY));
  const routes = Array.isArray(registry.routes) ? registry.routes : [];
  const privatePrefixes = Array.isArray(registry.privatePrefixes) ? registry.privatePrefixes : [];

  for (const route of routes) {
    if (typeof route.path !== 'string' || route.path.includes('.')) {
      fail(`登记路径不合法（不得含点）: ${String(route.path)}`);
      continue;
    }
    if (route.localeRouting && !existsSync(pageForRoute(route.path))) {
      fail(`登记了公开语言路由但缺少页面: ${route.path}`);
    }
  }

  for (const file of walk(join(APP_DIR, '[locale]')).filter((file) => file.endsWith('page.tsx'))) {
    checkPage(file, routes);
  }

  const localeDir = join(APP_DIR, '[locale]');
  if (!existsSync(localeDir)) fail('缺少 src/app/[locale] 公开语言路由');
  for (const name of ['layout.tsx', 'not-found.tsx']) {
    if (!existsSync(join(localeDir, name))) fail(`缺少 src/app/[locale]/${name}`);
  }

  const rootLayout = join(APP_DIR, 'layout.tsx');
  if (!existsSync(rootLayout)) {
    fail('缺少 src/app/layout.tsx');
  } else {
    const source = stripComments(read(rootLayout));
    for (const token of ['metadataBase', 'getLocale', '<html lang=']) {
      if (!source.includes(token)) fail(`src/app/layout.tsx 缺少 ${token}`);
    }
    if (/openGraph\s*:\s*\{[^}]*locale\s*:/su.test(source)) fail('根 layout 不得硬编码 openGraph.locale');
  }

  const rootNotFound = join(APP_DIR, 'not-found.tsx');
  if (!existsSync(rootNotFound)) {
    fail('缺少 src/app/not-found.tsx');
  } else {
    const source = stripComments(read(rootNotFound));
    if (/<html|<body/u.test(source)) fail('src/app/not-found.tsx 不得自带 <html>/<body>');
    if (!source.includes('errors.pages.notFound')) fail('src/app/not-found.tsx 缺少 404 文案');
    if (!source.includes('generateMetadata')) fail('src/app/not-found.tsx 缺少 generateMetadata');
    if (source.includes('robots')) fail('src/app/not-found.tsx 不得手写 robots（Next 按 404 自动 noindex）');
  }

  if (existsSync(join(APP_DIR, 'global-not-found.tsx'))) fail('不得存在 global-not-found.tsx');
  const nextConfig = join(process.cwd(), 'next.config.ts');
  if (existsSync(nextConfig) && /globalNotFound\s*:\s*true/u.test(read(nextConfig))) {
    fail('不得启用 experimental.globalNotFound');
  }

  for (const dir of ['(auth)', '(app)', 'ssr-app-api']) {
    for (const file of walk(join(APP_DIR, dir))) {
      if (file.includes('[locale]')) fail(`非公开区不得出现 [locale]: ${normalizePath(file)}`);
    }
  }

  for (const layout of ['(auth)/layout.tsx', '(app)/layout.tsx']) {
    const file = join(APP_DIR, layout);
    if (existsSync(file)) {
      const source = stripComments(read(file));
      if (!/robots\s*:\s*\{\s*index\s*:\s*false\s*,\s*follow\s*:\s*false/u.test(source)) {
        fail(`${layout}: 必须声明 noindex, nofollow`);
      }
    }
  }

  const sitemap = join(APP_DIR, 'sitemap.ts');
  const robots = join(APP_DIR, 'robots.ts');
  if (!existsSync(sitemap)) fail('缺少 src/app/sitemap.ts');
  if (!existsSync(robots)) fail('缺少 src/app/robots.ts');
  if (existsSync(sitemap)) {
    const source = read(sitemap);
    if (!source.includes('listLocalizedIndexableRoutes')) fail('sitemap 必须从登记表派生');
    if (!source.includes('buildHreflangLanguages')) fail('sitemap 必须输出 alternates.languages');
  }
  if (existsSync(robots)) {
    const source = read(robots);
    if (!source.includes('PRIVATE_ROUTE_PREFIXES')) fail('robots 必须从私有前缀登记表派生');
    if (/disallow\s*:\s*\[[^\]]*(?:zh-CN|en-US)/su.test(source)) fail('robots 不得屏蔽语言前缀');
  }

  for (const prefix of privatePrefixes) {
    if (/-(?:CN|US)\/?$/u.test(prefix)) fail(`私有前缀不得带语言: ${prefix}`);
  }

  const proxy = join(SRC_DIR, 'proxy.ts');
  if (!existsSync(proxy)) {
    fail('缺少 src/proxy.ts');
  } else {
    const source = read(proxy);
    for (const token of [
      'PUBLIC_LOCALE_HEADER',
      'forwardedHeaders.delete(PUBLIC_LOCALE_HEADER)',
      '308',
      'UNKNOWN_LOCALE_SENTINEL',
    ]) {
      if (!source.includes(token)) fail(`src/proxy.ts 缺少 ${token}`);
    }
    if (!/NEXT_INTERNAL_SEGMENT\s*=\s*['"]_next['"]/u.test(source)) fail('proxy 只能放行 _next 内部段');
    if (/startsWith\(['"]_['"]\)/u.test(source)) fail('proxy 不得放行任意 _ 前缀');
  }

  const request = join(SRC_DIR, 'i18n', 'request.ts');
  if (!existsSync(request)) {
    fail('缺少 src/i18n/request.ts');
  } else {
    const source = read(request);
    const urlIndex = source.indexOf('PUBLIC_LOCALE_HEADER');
    const cookieIndex = source.indexOf('await cookies()');
    if (urlIndex < 0 || cookieIndex < 0 || urlIndex > cookieIndex) {
      fail('locale 解析链必须 URL 先于 cookie');
    }
    if (!source.includes('NO_SIGNAL_FALLBACK_LOCALE')) fail('缺少无信号兜底语言');
    if (source.includes('DEFAULT_LOCALE')) fail('不得恢复 DEFAULT_LOCALE');
  }

  for (const file of ['robots.ts', 'sitemap.ts', 'manifest.ts', 'icon.svg', 'opengraph-image.tsx']) {
    if (!existsSync(join(APP_DIR, file))) fail(`SEO 基建必须在 src/app 根: ${file}`);
    if (existsSync(join(localeDir, file))) fail(`SEO 基建不得进入语言段: ${file}`);
  }
}

if (!existsSync(join(APP_DIR, '[locale]'))) {
  process.stdout.write('SEO 检查：当前变体没有公开语言路由，跳过\n');
  process.exit(0);
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const files = listFiles(mode).map(normalizePath);
const relevant = files.filter((file) => RELEVANT.test(file));

if (mode !== 'tracked' && relevant.length === 0) {
  process.stdout.write('SEO/多语言路由检查：未涉及公开页或路由配置，跳过\n');
  process.exit(0);
}

checkFiles();

if (failures.length > 0) {
  process.stderr.write(`SEO/多语言路由检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('SEO/多语言路由静态检查通过\n');
