#!/usr/bin/env node
/**
 * 公开页语义 HTML 静态检查。渲染后的完整结构由 check-seo-runtime.mjs 兜底。
 *
 * 用法：node scripts/check-seo-content.mjs --staged
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const APP_DIR = join(process.cwd(), 'src', 'app');
const SHOWCASE_DIR = join(process.cwd(), 'src', 'features', 'showcase');
const RELEVANT = /^src\/(?:app\/\[locale\]|features\/showcase)\/.+\.tsx$/u;
const failures = [];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function filesFor(mode) {
  if (mode === 'tracked') return git(['ls-files']).split('\n').filter(Boolean);
  if (mode === 'staged')
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  const index = process.argv.indexOf('--files');
  return index >= 0 ? process.argv.slice(index + 1) : [];
}

function fail(message) {
  failures.push(message);
}

function checkFile(file) {
  const relative = file.slice(process.cwd().length + 1).replaceAll('\\', '/');
  const source = readFileSync(file, 'utf8');
  if (/href\s*=\s*['"](?:#|javascript:)/iu.test(source)) fail(`${relative}: 禁止空链接或 javascript: 链接`);
  if (/<img\b(?![^>]*\balt=)[^>]*>/iu.test(source)) fail(`${relative}: <img> 必须有 alt`);
  if (/dangerouslySetInnerHTML/u.test(source) && !relative.startsWith('src/shared/security/')) {
    fail(`${relative}: 富文本必须走 SafeHtml/JsonLd`);
  }
}

if (!existsSync(join(APP_DIR, '[locale]'))) {
  process.stdout.write('SEO 检查：当前变体没有公开语言路由，跳过\n');
  process.exit(0);
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const changed = filesFor(mode).map((file) => file.replaceAll('\\', '/'));
const relevant = changed.filter((file) => RELEVANT.test(file));

if (mode !== 'tracked' && relevant.length === 0) {
  process.stdout.write('SEO 语义检查：未涉及公开页渲染文件，跳过\n');
  process.exit(0);
}

const publicFiles = [
  ...walk(join(APP_DIR, '[locale]')).filter(
    (file) => file.endsWith('.tsx') && !/(?:not-found|error|layout|loading)\.tsx$/u.test(file),
  ),
  ...walk(SHOWCASE_DIR).filter(
    (file) => file.endsWith('.tsx') && !/(?:not-found|error|layout|loading)\.tsx$/u.test(file),
  ),
];
for (const file of publicFiles) checkFile(file);

const combined = publicFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const h1Count = (combined.match(/<h1\b/gu) ?? []).length;
if (h1Count !== 1) fail(`公开首页渲染树必须恰好一个 <h1>，当前 ${h1Count} 个`);
if (!combined.includes('<main')) fail('公开页渲染树必须包含 <main>');

if (failures.length > 0) {
  process.stderr.write(`SEO 语义检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('SEO 语义静态检查通过\n');
