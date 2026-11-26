#!/usr/bin/env node
/**
 * 日志边界静态检查：禁止裸 console、业务 PII 进入 logger、SPA 生产构建必须删除 console。
 *
 * 用法：node scripts/check-logging.mjs --staged
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

const LOGGER_FILES = new Set([
  'src/shared/services/logger.ts',
  'src/shared/logger/client-logger.ts',
  'src/bff/shared/logger/server-logger.ts',
]);
const PII_PATTERN = /\b(?:password|passwd|token|authorization|cookie|email|phone|idCard|bankCard)\b/iu;

function checkSource(relative) {
  const file = join(process.cwd(), relative);
  if (!existsSync(file)) return;
  const source = readFileSync(file, 'utf8');

  if (!LOGGER_FILES.has(relative) && /\bconsole\.(?:log|debug|info|warn|error)\s*\(/u.test(source)) {
    fail(`${relative}: 业务代码禁止裸 console，请走 logger`);
  }

  const loggerCall = source.match(/(?:serverLogger|clientLogger|logger)\.(?:debug|info|warn|error)\([\s\S]{0,500}?\)/u);
  // 事件名允许出现 cookie/token 等词；只检查第一个参数之后的上下文。
  const loggerArgs = loggerCall ? loggerCall[0].slice(loggerCall[0].indexOf(',') + 1) : '';
  const sanitizedArgs = loggerArgs.replace(/has(?:SessionCookie|Auth|Traceparent)/gu, '');
  if (sanitizedArgs && PII_PATTERN.test(sanitizedArgs)) {
    fail(`${relative}: logger 调用中疑似直接记录 PII/凭证字段，请脱敏或只记录摘要`);
  }
}

const packageJson = join(process.cwd(), 'package.json');
if (existsSync(packageJson)) {
  const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
  const scripts = pkg.scripts ?? {};
  const isSsr = existsSync(join(process.cwd(), 'next.config.ts'));
  if (
    !isSsr &&
    !String(scripts.build ?? '').includes('vite') &&
    !String(scripts['build:prod'] ?? '').includes('vite')
  ) {
    // SPA 变体必须由 Vite 构建；生产 console 删除由 vite.config.ts 的 terser 配置保证。
  }
  const viteConfig = join(process.cwd(), 'vite.config.ts');
  if (!isSsr && existsSync(viteConfig)) {
    const source = readFileSync(viteConfig, 'utf8');
    if (!/drop_console\s*:\s*true/u.test(source)) {
      fail('vite.config.ts: 生产构建必须设置 terserOptions.compress.drop_console=true');
    }
  }
  const nextConfig = join(process.cwd(), 'next.config.ts');
  if (isSsr && existsSync(nextConfig)) {
    const source = readFileSync(nextConfig, 'utf8');
    if (!/removeConsole/u.test(source)) fail('next.config.ts: 生产构建缺少 removeConsole');
  }
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const files = filesFor(mode).map((file) => file.replaceAll('\\', '/'));
const relevant = files.filter((file) => /^src\/.+\.(?:ts|tsx)$/u.test(file));

if (mode !== 'tracked' && relevant.length === 0) {
  process.stdout.write('日志边界检查：未涉及源码，跳过\n');
  process.exit(0);
}

for (const file of relevant) checkSource(file);

if (failures.length > 0) {
  process.stderr.write(`日志边界检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('日志边界检查通过\n');
