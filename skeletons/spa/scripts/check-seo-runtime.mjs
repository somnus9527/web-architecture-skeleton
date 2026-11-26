#!/usr/bin/env node
/**
 * 运行中的 SSR 站点 SEO 冒烟检查。CI 在 next build 后启动 standalone，再调用本脚本。
 *
 * 用法：node scripts/check-seo-runtime.mjs --base-url http://127.0.0.1:4311 [--origin https://app.example.com]
 */

import process from 'node:process';

const args = process.argv.slice(2);
const baseUrlIndex = args.indexOf('--base-url');
const originIndex = args.indexOf('--origin');
const baseUrl = (baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : 'http://127.0.0.1:3001')?.replace(/\/$/u, '');
const origin = (originIndex >= 0 ? args[originIndex + 1] : process.env.APP_ORIGIN)?.replace(/\/$/u, '');
const locales = ['zh-CN', 'en-US'];
const failures = [];

function fail(message) {
  failures.push(message);
}

async function get(path, redirect = 'follow') {
  return globalThis.fetch(`${baseUrl}${path}`, {
    redirect,
    headers: { Accept: 'text/html,application/xml,text/plain' },
  });
}

function expect(condition, message) {
  if (!condition) fail(message);
}

async function checkLocale(locale) {
  const path = `/${locale}`;
  const response = await get(path);
  const html = await response.text();
  expect(response.status === 200, `${path} 期望 200，实际 ${response.status}`);
  expect(new RegExp(`<html[^>]*\\blang="${locale}"`, 'u').test(html), `${path} 缺少 <html lang="${locale}">`);
  expect(/<h1\b/u.test(html), `${path} 缺少 <h1>`);
  expect(/<main\b/u.test(html), `${path} 缺少 <main>`);
  expect(/rel="canonical"/u.test(html), `${path} 缺少 canonical`);
  for (const target of locales) {
    expect(new RegExp(`hreflang="${target}"`, 'iu').test(html), `${path} 缺少 hreflang="${target}"`);
  }
  expect(/hreflang="x-default"/iu.test(html), `${path} 缺少 hreflang="x-default"`);
  const expectedOgLocale = locale === 'zh-CN' ? 'zh_CN' : 'en_US';
  expect(
    html.includes(`property="og:locale" content="${expectedOgLocale}"`),
    `${path} 缺少 og:locale=${expectedOgLocale}`,
  );
  expect(html.includes('property="og:image"'), `${path} 缺少 og:image`);
  if (origin) {
    expect(html.includes(`${origin}/${locale}`), `${path} canonical/hreflang 未使用 ${origin}`);
  }
}

async function checkRoot() {
  const response = await get('/', 'manual');
  expect(response.status === 308, `/ 期望 308，实际 ${response.status}`);
  const location = response.headers.get('location') ?? '';
  expect(location.endsWith('/en-US'), `/ 308 目标应为 /en-US，实际 ${location}`);
}

async function check404(path) {
  const response = await get(path);
  expect(response.status === 404, `${path} 期望 404，实际 ${response.status}`);
}

async function checkSitemap() {
  const response = await get('/sitemap.xml');
  const xml = await response.text();
  expect(response.status === 200, `/sitemap.xml 期望 200，实际 ${response.status}`);
  for (const locale of locales) {
    expect(xml.includes(`/${locale}`), `/sitemap.xml 缺少 ${locale} 条目`);
  }
  expect(xml.includes('x-default'), '/sitemap.xml 缺少 x-default alternates');
}

/**
 * 校验 CSP nonce 真的生效：生产响应头带 nonce、script-src 不含 unsafe-inline、页面内联 script 带同一 nonce。
 *
 * 只查响应头不够——Next 必须把 nonce 打到它自己的 bootstrap/inline script 上，否则部署后页面直接白屏。
 *
 * @returns {void}
 */
async function checkContentSecurityPolicy() {
  const first = await get(`/${locales[0]}`);
  const firstHtml = await first.text();
  const policy = first.headers.get('content-security-policy') ?? '';
  expect(Boolean(policy), '响应缺少 Content-Security-Policy 头');

  const scriptDirective =
    policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src')) ?? '';
  expect(!scriptDirective.includes("'unsafe-inline'"), '生产 script-src 仍包含 unsafe-inline');
  expect(!scriptDirective.includes('unsafe-eval'), '生产 script-src 仍包含 unsafe-eval');

  const nonce = /'nonce-([^']+)'/u.exec(scriptDirective)?.[1];
  expect(Boolean(nonce), 'CSP 缺少 nonce');

  if (nonce) {
    const applies = new RegExp(`<script[^>]*nonce=["']${nonce}["']`, 'u').test(firstHtml);
    expect(applies, `页面内联 script 未带 CSP nonce（${nonce}）`);
  }

  const second = await get(`/${locales[0]}`);
  const secondPolicy = second.headers.get('content-security-policy') ?? '';
  const secondNonce = /'nonce-([^']+)'/u.exec(secondPolicy)?.[1];
  expect(Boolean(secondNonce) && secondNonce !== nonce, 'CSP nonce 未做到每请求不同');
}

async function checkRobots() {
  const response = await get('/robots.txt');
  const text = await response.text();
  expect(response.status === 200, `/robots.txt 期望 200，实际 ${response.status}`);
  expect(text.includes('/login'), '/robots.txt 未屏蔽 /login');
  expect(text.includes('/ssr-app-api/'), '/robots.txt 未屏蔽 BFF');
  expect(!/\/(?:zh-CN|en-US)/u.test(text), '/robots.txt 不得屏蔽语言前缀');
}

await checkRoot();
for (const locale of locales) await checkLocale(locale);
await check404('/fr');
await check404('/zh-CN/login');
await check404('/wp-login.php');
await checkSitemap();
await checkRobots();
await checkContentSecurityPolicy();

if (failures.length > 0) {
  process.stderr.write(`SEO 运行时检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('SEO 运行时检查通过\n');
