#!/usr/bin/env node
/**
 * 用户可见文案静态检查：公开页/feature 的 JSX 文本与可访问名称不得硬编码。
 *
 * 用法：node scripts/check-i18n-copy.mjs --staged
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const COPY_ATTRIBUTES = /(?:placeholder|aria-label|title|alt)\s*=\s*"([^"]*[A-Za-z\u4e00-\u9fff][^"]*)"/gu;
const JSX_TEXT = />(\s*[^<>{}\n][^<>{}]*)</gu;
const ALLOWED_TEXT = /^(?:[-–—|/·•…\d\s]+|404|SSR|BFF|Promise)$/u;
const failures = [];

function fail(message) {
  failures.push(message);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function filesFor(mode) {
  if (mode === 'tracked') return git(['ls-files']).split('\n').filter(Boolean);
  if (mode === 'staged')
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  const index = process.argv.indexOf('--files');
  return index >= 0 ? process.argv.slice(index + 1) : [];
}

function isRelevant(file) {
  return (
    /^src\/(?:app\/\[locale\]|features)\/.+\.tsx$/u.test(file) &&
    !/\.(?:test|spec)\.tsx$/u.test(file) &&
    !/global-error|opengraph-image|manifest/u.test(file)
  );
}

function check(file) {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^[ \t]*\/\/.*$/gmu, '');
  const relative = file.slice(process.cwd().length + 1).replaceAll('\\', '/');

  for (const match of source.matchAll(COPY_ATTRIBUTES)) {
    if (!ALLOWED_TEXT.test(match[1].trim())) fail(`${relative}: 属性文案必须走 i18n: ${match[1]}`);
  }

  for (const match of source.matchAll(JSX_TEXT)) {
    const text = match[1].trim();
    if (!text || ALLOWED_TEXT.test(text) || text.startsWith('{')) continue;
    if (/[A-Za-z\u4e00-\u9fff]{2,}/u.test(text)) fail(`${relative}: JSX 文本必须走 i18n: ${text.slice(0, 40)}`);
  }
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const files = filesFor(mode).map((file) => file.replaceAll('\\', '/'));
const relevant = files.filter(isRelevant);

if (mode !== 'tracked' && relevant.length === 0) {
  process.stdout.write('i18n 文案检查：未涉及公开页/feature 组件，跳过\n');
  process.exit(0);
}

for (const file of relevant) {
  const absolute = join(process.cwd(), file);
  if (existsSync(absolute)) check(absolute);
}

if (failures.length > 0) {
  process.stderr.write(`i18n 文案检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('i18n 文案检查通过\n');
