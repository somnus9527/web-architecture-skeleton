#!/usr/bin/env node
/**
 * 轻量无障碍静态检查：图片 alt、非交互元素点击、图标按钮可访问名称。
 *
 * 用法：node scripts/check-a11y.mjs --staged
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const failures = [];

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

function fail(message) {
  failures.push(message);
}

function check(relative) {
  const file = join(process.cwd(), relative);
  if (!existsSync(file)) return;
  const source = readFileSync(file, 'utf8');

  if (/<(?:img|Image)\b(?![^>]*\balt=)[^>]*>/iu.test(source)) fail(`${relative}: <img>/<Image> 必须有 alt`);
  if (/<(?:div|span)\b[^>]*\bonClick=/iu.test(source)) {
    fail(`${relative}: 非交互元素不得绑定 onClick，请使用 button/Link/共享组件`);
  }
  if (/<button\b[^>]*>\s*<[^>]+\/>\s*<\/button>/iu.test(source)) {
    fail(`${relative}: 图标按钮必须有可访问名称（aria-label 或可见文案）`);
  }
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const files = filesFor(mode)
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /^src\/.+\.tsx$/u.test(file) && !/\.(?:test|spec)\.tsx$/u.test(file));

if (mode !== 'tracked' && files.length === 0) {
  process.stdout.write('无障碍检查：未涉及 TSX 源码，跳过\n');
  process.exit(0);
}

for (const file of files) check(file);

if (failures.length > 0) {
  process.stderr.write(`无障碍检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('无障碍静态检查通过\n');
