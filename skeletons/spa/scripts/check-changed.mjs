#!/usr/bin/env node
/**
 * pre-push 增量检查：按本次推送的变更路径挑选检查，不跑全量架构测试。
 *
 * 用法：node scripts/check-changed.mjs --base @{push}
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ARCH_TESTS = {
  features: [
    'src/test/architecture/feature-isolation.test.ts',
    'src/test/architecture/hook-duplication.test.ts',
    'src/test/architecture/file-split-boundary.test.ts',
    'src/test/architecture/logging-boundary.test.ts',
  ],
  shared: [
    'src/test/architecture/shared-independence.test.ts',
    'src/test/architecture/shared-ui-contract.test.ts',
    'src/test/architecture/shared-capabilities.test.ts',
    'src/test/architecture/file-split-boundary.test.ts',
    'src/test/architecture/logging-boundary.test.ts',
  ],
  app: [
    'src/test/architecture/layer-boundary.test.ts',
    'src/test/architecture/file-split-boundary.test.ts',
    'src/test/architecture/logging-boundary.test.ts',
    'src/test/architecture/client-boundary.test.ts',
    'src/test/architecture/server-boundary.test.ts',
    'src/test/architecture/route-prefix-boundary.test.ts',
  ],
  seo: ['src/test/architecture/seo-boundary.test.ts', 'src/test/architecture/public-locale-routing.test.ts'],
  ui: [
    'src/test/architecture/ui-stack.test.ts',
    'src/test/architecture/ui-catalog.test.ts',
    'src/test/architecture/design-tokens.test.ts',
  ],
  bff: [
    'src/test/architecture/bff-layers.test.ts',
    'src/test/architecture/server-boundary.test.ts',
    'src/test/architecture/client-boundary.test.ts',
  ],
  mock: ['src/test/architecture/mock-contract.test.ts'],
  anySource: ['src/test/architecture/file-split-boundary.test.ts'],
};

/**
 * 解析 --base。
 *
 * @returns {string} git diff base。
 */
function readBase() {
  const index = process.argv.indexOf('--base');
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : '@{push}';
}

/**
 * 取变更文件；base 不可用时逐级回退。
 *
 * @param {string} base - 用户给的 base。
 * @returns {string[]} 变更文件。
 */
function listChangedFiles(base) {
  const candidates = [base, 'origin/main', 'HEAD~1'];
  const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { encoding: 'utf8' }).trim();

  for (const candidate of candidates) {
    try {
      return execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${candidate}...HEAD`], {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
        .filter((file) => !prefix || file.startsWith(prefix))
        .map((file) => (prefix ? file.slice(prefix.length) : file));
    } catch {
      // 继续尝试下一个 base。
    }
  }

  return [];
}

/**
 * 执行命令，失败即退出。
 *
 * @param {string} command - 可执行文件。
 * @param {string[]} args - 参数。
 * @returns {void}
 */
function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

const files = listChangedFiles(readBase());
if (files.length === 0) {
  process.stdout.write('增量检查：没有可比较的变更，跳过\n');
  process.exit(0);
}

const sourceFiles = files.filter((file) => /\.(?:ts|tsx|js|jsx)$/u.test(file) && !/^(?:docs|scripts)\//u.test(file));
const docsOnly = files.every((file) => file.endsWith('.md') || file.startsWith('docs/'));
const toolingChanged = files.some(
  (file) => file.startsWith('scripts/') || file.startsWith('.husky/') || file === 'package.json',
);

if (docsOnly) {
  if (existsSync('tools/check-doc-links.mjs')) {
    run(process.execPath, ['tools/check-doc-links.mjs']);
  } else {
    run('git', ['diff', '--check']);
  }
  process.exit(0);
}

if (toolingChanged && existsSync('scripts/verify-gates.mjs')) {
  run(process.execPath, ['scripts/verify-gates.mjs']);
}

if (sourceFiles.length > 0) {
  const lintBin = join(process.cwd(), 'node_modules', '.bin', 'eslint');
  if (existsSync(lintBin)) {
    run(lintBin, [...sourceFiles, '--max-warnings=0']);
  }

  if (existsSync('scripts/check-security.mjs')) {
    run(process.execPath, ['scripts/check-security.mjs', '--files', ...sourceFiles]);
  }

  const tests = new Set();
  if (files.some((file) => file.startsWith('src/features/'))) {
    ARCH_TESTS.features.forEach((test) => tests.add(test));
  }
  if (files.some((file) => file.startsWith('src/shared/'))) {
    ARCH_TESTS.shared.forEach((test) => tests.add(test));
  }
  if (files.some((file) => file.startsWith('src/app/') || file.startsWith('src/router/'))) {
    ARCH_TESTS.app.forEach((test) => tests.add(test));
  }
  if (
    files.some(
      (file) =>
        file.startsWith('src/app/') ||
        file === 'src/proxy.ts' ||
        file.startsWith('src/i18n/') ||
        /^src\/shared\/(?:seo|i18n|navigation)\//u.test(file) ||
        file === 'next.config.ts',
    )
  ) {
    ARCH_TESTS.seo.forEach((test) => tests.add(test));
  }
  if (
    files.some(
      (file) => file.startsWith('src/shared/ui/') || file.startsWith('src/shared/theme/') || file === 'package.json',
    )
  ) {
    ARCH_TESTS.ui.forEach((test) => tests.add(test));
  }
  if (files.some((file) => file.startsWith('src/bff/'))) {
    ARCH_TESTS.bff.forEach((test) => tests.add(test));
  }
  if (files.some((file) => /^(?:mock|mocks)\/(?:openapi|examples)\//u.test(file))) {
    ARCH_TESTS.mock.forEach((test) => tests.add(test));
  }
  if (files.some((file) => file.startsWith('src/'))) {
    ARCH_TESTS.anySource.forEach((test) => tests.add(test));
  }

  const existingTests = [...tests].filter((test) => existsSync(test));
  const vitestBin = join(process.cwd(), 'node_modules', '.bin', 'vitest');
  if (existingTests.length > 0 && existsSync(vitestBin)) {
    run(vitestBin, ['run', ...existingTests]);
  }

  const tscBin = join(process.cwd(), 'node_modules', '.bin', 'tsc');
  if (existsSync(tscBin) && files.some((file) => /\.(?:ts|tsx)$/u.test(file))) {
    run(tscBin, ['-b', '--pretty', 'false']);
  }
}

process.stdout.write('增量检查通过（完整结论以 CI 为准）\n');
