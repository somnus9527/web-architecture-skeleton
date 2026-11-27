#!/usr/bin/env node
/**
 * pre-commit 分片检查入口：只扫 staged 文件，保持快速。
 *
 * 用法：node scripts/check-staged.mjs --staged
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const checks = [
  ['仓库卫生', 'check-repo-hygiene.mjs'],
  ['安全扫描', 'check-security.mjs'],
  ['SEO/多语言路由', 'check-seo-routing.mjs'],
  ['SEO 语义', 'check-seo-content.mjs'],
  ['UI 边界', 'check-ui-boundary.mjs'],
  ['共享能力复用', 'check-reuse.mjs'],
  ['日志边界', 'check-logging.mjs'],
  ['错误码目录', 'generate-error-codes.mjs'],
  ['i18n 硬编码', 'check-i18n-copy.mjs'],
  ['无障碍', 'check-a11y.mjs'],
  ['架构分片', 'check-architecture-staged.mjs'],
];

let failed = false;

for (const [label, script] of checks) {
  if (!existsSync(new URL(`./${script}`, import.meta.url))) {
    process.stderr.write(`缺少检查脚本 scripts/${script}\n`);
    failed = true;
    continue;
  }

  try {
    execFileSync(process.execPath, [new URL(`./${script}`, import.meta.url).pathname, '--staged'], {
      stdio: 'inherit',
    });
  } catch {
    process.stderr.write(`${label}未通过\n`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
