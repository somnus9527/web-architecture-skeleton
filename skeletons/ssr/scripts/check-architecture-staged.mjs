#!/usr/bin/env node
/**
 * pre-commit 架构测试分片：按 staged 路径只跑相关架构测试，避免全量。
 *
 * 用法：node scripts/check-architecture-staged.mjs --staged
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/**
 * 根据 staged 路径选择架构测试。
 *
 * @param {string[]} files - staged 文件。
 * @returns {string[]} 测试文件。
 */
function selectTests(files) {
  const tests = new Set();
  const add = (...items) => items.forEach((item) => tests.add(item));

  if (files.some((file) => file.startsWith('src/features/'))) {
    add(
      'src/test/architecture/feature-isolation.test.ts',
      'src/test/architecture/file-split-boundary.test.ts',
      'src/test/architecture/logging-boundary.test.ts',
    );
  }
  if (files.some((file) => file.startsWith('src/shared/'))) {
    add(
      'src/test/architecture/shared-independence.test.ts',
      'src/test/architecture/shared-ui-contract.test.ts',
      'src/test/architecture/shared-capabilities.test.ts',
      'src/test/architecture/reuse-registry.test.ts',
      'src/test/architecture/file-split-boundary.test.ts',
      'src/test/architecture/logging-boundary.test.ts',
    );
  }
  if (
    files.some(
      (file) => file.startsWith('src/shared/ui/') || file.startsWith('src/shared/theme/') || file === 'package.json',
    )
  ) {
    add(
      'src/test/architecture/ui-stack.test.ts',
      'src/test/architecture/ui-catalog.test.ts',
      'src/test/architecture/design-tokens.test.ts',
    );
  }
  if (files.some((file) => file.startsWith('src/app/') || file.startsWith('src/router/'))) {
    add(
      'src/test/architecture/layer-boundary.test.ts',
      'src/test/architecture/client-boundary.test.ts',
      'src/test/architecture/server-boundary.test.ts',
      'src/test/architecture/route-prefix-boundary.test.ts',
      'src/test/architecture/file-split-boundary.test.ts',
      'src/test/architecture/logging-boundary.test.ts',
    );
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
    add('src/test/architecture/seo-boundary.test.ts', 'src/test/architecture/public-locale-routing.test.ts');
  }
  if (files.some((file) => file.startsWith('src/bff/'))) {
    add(
      'src/test/architecture/bff-layers.test.ts',
      'src/test/architecture/logging-boundary.test.ts',
      'src/test/architecture/server-boundary.test.ts',
      'src/test/architecture/client-boundary.test.ts',
    );
  }
  if (files.some((file) => /^(?:mock|mocks)\/(?:openapi|examples)\//u.test(file))) {
    add('src/test/architecture/mock-contract.test.ts');
  }

  return [...tests];
}

const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const tests = selectTests(files).filter((test) => existsSync(test));
const vitest = join(process.cwd(), 'node_modules', '.bin', 'vitest');

if (tests.length === 0 || !existsSync(vitest)) {
  process.stdout.write('架构分片检查：无相关测试，跳过\n');
  process.exit(0);
}

execFileSync(vitest, ['run', ...tests], { stdio: 'inherit' });
