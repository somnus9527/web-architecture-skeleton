#!/usr/bin/env node
/**
 * 共享能力复用检查：命中重复实现时失败，并给出可直接粘贴的替代 import。
 *
 * 规则（无合法出口不启用，每条命中必须指向一个已存在的能力）：
 * - R1 手写请求三态 → useRequest（读取）/ useAsyncAction（写入）
 * - R2 手写去抖 → useDebouncedValue
 * - R3 直连浏览器存储或 media query → store / 共享 hook
 * - R4 feature 新建通用名组件 → @/shared/ui
 * - R5 深引 shared 内部文件 → barrel
 * - R6 feature 直接发请求 → @/shared/tools/api-client + feature service
 *
 * 用法：
 *   node scripts/check-reuse.mjs --staged
 *   node scripts/check-reuse.mjs --tracked
 *   node scripts/check-reuse.mjs --files src/features/a.tsx
 *   node scripts/check-reuse.mjs --list
 *   node scripts/check-reuse.mjs --files a.tsx --root /tmp/demo
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const SOURCE_PATTERN = /\.(?:ts|tsx)$/u;
const BUSINESS_PATTERN = /^src\/(?:features|app|router)\//u;
const FEATURE_PATTERN = /^src\/features\//u;
const SHARED_HOOK_PATTERN = /^src\/shared\/hooks\//u;
const IGNORED_PATTERN = /(?:^|\/)(?:src\/test|__tests__|__mocks__|mocks?)(?:\/|$)|\.(?:test|spec)\./u;

/**
 * feature 里不许自建的通用名文件名（必须有对应的 @/shared/ui 出口）。
 *
 * P0 只收已存在出口的名字；Dialog / Table / TextArea 等随 facade 落地后再扩充，
 * 避免出现“禁了但只能违规”的死角。
 */
const GENERIC_COMPONENT_NAMES = new Set([
  'button',
  'input',
  'select',
  'async-state',
  'empty-state',
  'page-header',
  'stat-card',
  'field-row',
  'status-pill',
]);

const violations = [];

/**
 * 记录一条违规。
 *
 * @param {string} file - 相对仓库根目录的路径。
 * @param {number} line - 行号。
 * @param {string} rule - 规则号。
 * @param {string} message - 失败说明与替代方案。
 * @returns {void}
 */
function fail(file, line, rule, message) {
  violations.push({ file, line, rule, message });
}

/**
 * 计算字符下标所在行号。
 *
 * @param {string} source - 文件内容。
 * @param {number} index - 字符下标。
 * @returns {number} 1 起的行号。
 */
function lineOf(source, index) {
  return source.slice(0, Math.max(index, 0)).split('\n').length;
}

/**
 * 判断文件是否纳入检查。
 *
 * @param {string} file - 相对路径。
 * @returns {boolean} 是否检查。
 */
function isCheckedSource(file) {
  return SOURCE_PATTERN.test(file) && BUSINESS_PATTERN.test(file) && !IGNORED_PATTERN.test(file);
}

/**
 * 读取注册表。
 *
 * @param {string} root - 项目根目录。
 * @returns {Array<Record<string, string>>} 注册项。
 */
function readRegistry(root) {
  const path = join(root, 'docs', 'capabilities.json');
  if (!existsSync(path)) {
    throw new Error('缺少 docs/capabilities.json；请确认已运行物化或初始化技能');
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('docs/capabilities.json 必须是数组');
  }

  return parsed;
}

/**
 * 按模式取文件列表。
 *
 * @param {string} mode - staged / tracked / files。
 * @param {string} root - 项目根目录。
 * @returns {string[]} 相对路径列表。
 */
function listFiles(mode, root) {
  if (mode === 'files') {
    const index = process.argv.indexOf('--files');
    return process.argv
      .slice(index + 1)
      .filter((file) => !file.startsWith('--'))
      .map((file) => file.replace(/^\.\//u, '').replaceAll('\\', '/'));
  }

  const args = mode === 'staged' ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR'] : ['ls-files'];
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => file.replaceAll('\\', '/'));
}

/**
 * 检查单个文件。
 *
 * @param {string} root - 项目根目录。
 * @param {string} file - 相对路径。
 * @returns {void}
 */
function checkFile(root, file) {
  if (!isCheckedSource(file)) {
    return;
  }

  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    return;
  }

  const source = readFileSync(absolute, 'utf8');
  const isFeature = FEATURE_PATTERN.test(file);

  const requestState = source.search(/set(?:Loading|IsLoading|LoadState|Pending)\s*\(/u);
  const asyncBoundary = /(?:await\s|\.then\s*\(|\bfetch\s*\(|\bService\.)/u.test(source);
  const usesSharedRequest = /useRequest\s*\(|useAsyncAction\s*\(/u.test(source);
  if (isFeature && /useEffect\s*\(/u.test(source) && requestState >= 0 && asyncBoundary && !usesSharedRequest) {
    fail(
      file,
      lineOf(source, requestState),
      'R1',
      '手写请求三态，请改用 @/shared/hooks 的 useRequest（读取）或 useAsyncAction（写入）',
    );
  }

  const timer = source.search(/setTimeout\s*\(/u);
  const debounceShape =
    /setTimeout\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{?[\s\S]{0,240}?\bset[A-Z][\w$]*\s*\(/u;
  if (isFeature && !SHARED_HOOK_PATTERN.test(file) && /clearTimeout\s*\(/u.test(source) && debounceShape.test(source)) {
    fail(file, lineOf(source, timer), 'R2', '手写去抖，请改用 @/shared/hooks 的 useDebouncedValue');
  }

  const browserApi = source.search(/\b(?:localStorage|sessionStorage|matchMedia)\b/u);
  if (isFeature && browserApi >= 0) {
    fail(file, lineOf(source, browserApi), 'R3', '直接访问浏览器存储或 media query，请经 store 或共享 hook');
  }

  if (isFeature) {
    const name = basename(file).replace(SOURCE_PATTERN, '');
    if (GENERIC_COMPONENT_NAMES.has(name)) {
      fail(file, 1, 'R4', `通用名组件 ${name}.tsx 请放进 src/shared/ui 并登记 catalog`);
    }
  }

  const deepImport = source.search(/from\s+['"]@\/shared\/(?:hooks|ui)\/[^'"]+['"]/u);
  if (deepImport >= 0) {
    fail(file, lineOf(source, deepImport), 'R5', '深引 shared 内部文件，请改从 @/shared/hooks 或 @/shared/ui 导入');
  }

  if (isFeature) {
    const rawRequest = source.search(/\bfetch\s*\(|axios\.(?:create|request|get|post|put|patch|delete)\s*\(/u);
    if (rawRequest >= 0) {
      fail(file, lineOf(source, rawRequest), 'R6', '直接发请求，请走 @/shared/tools/api-client 与 feature service');
    }
  }
}

/**
 * 打印注册表。
 *
 * @param {string} root - 项目根目录。
 * @returns {void}
 */
function printRegistry(root) {
  const entries = readRegistry(root);
  const width = Math.max(...entries.map((entry) => entry.id.length), 2);
  process.stdout.write(`共享能力注册表（${entries.length} 项）：\n`);
  for (const entry of entries) {
    process.stdout.write(`  ${entry.id.padEnd(width)}  ${entry.kind.padEnd(7)}  ${entry.import}\n`);
    process.stdout.write(`  ${' '.repeat(width)}  ${entry.purpose}\n`);
  }
}

/**
 * 入口。
 *
 * @returns {void}
 */
function main() {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? resolve(process.argv[rootIndex + 1]) : process.cwd();
  const mode = process.argv.includes('--list')
    ? 'list'
    : process.argv.includes('--staged')
      ? 'staged'
      : process.argv.includes('--tracked')
        ? 'tracked'
        : 'files';

  if (mode === 'list') {
    printRegistry(root);
    return;
  }

  const files = listFiles(mode, root);
  const relevant = files.filter(isCheckedSource);

  if (relevant.length === 0) {
    process.stdout.write('共享能力复用检查：未涉及业务源码，跳过\n');
    return;
  }

  for (const file of relevant) {
    checkFile(root, file);
  }

  if (violations.length > 0) {
    process.stderr.write(`共享能力复用检查失败（${violations.length} 项）：\n`);
    for (const violation of violations) {
      process.stderr.write(`  - ${violation.file}:${violation.line} ${violation.rule} ${violation.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`共享能力复用检查通过（${relevant.length} 个文件）\n`);
}

main();
