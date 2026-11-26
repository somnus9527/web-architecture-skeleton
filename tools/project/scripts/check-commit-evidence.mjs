#!/usr/bin/env node
/**
 * commit-msg 证据检查：根据 staged 文件要求提交信息带对应 trailer。
 *
 * commitlint 只校验 message 语法；本脚本补上「这次改动需要什么证据」。
 *
 * 用法：node scripts/check-commit-evidence.mjs .git/COMMIT_EDITMSG
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const SECURITY_PATHS = [
  /(?:^|\/)src\/shared\/tools\/api-client\.ts$/u,
  /(?:^|\/)src\/shared\/store\/session-store\.ts$/u,
  /(?:^|\/)src\/shared\/utils\/cookie\.ts$/u,
  /(?:^|\/)src\/bff\/shared\/route-security\.ts$/u,
  /(?:^|\/)src\/proxy\.ts$/u,
  /(?:^|\/)\.env(?:\.|$)/u,
];

const RULES = [
  {
    name: 'Security-Review',
    test: (file) => SECURITY_PATHS.some((pattern) => pattern.test(file)),
    message: '改动了鉴权/安全敏感文件，请在提交信息中补 `Security-Review: <一句话>`。',
  },
  {
    name: 'UI-Catalog',
    test: (file) => /(?:^|\/)src\/shared\/components\/ui\/[a-z0-9-]+\.tsx$/u.test(file),
    message: '改动 shared UI 原语，请在提交信息中补 `UI-Catalog: <Component>`。',
  },
  {
    name: 'Dependency',
    test: (file) => /(?:^|\/)package\.json$/u.test(file) || /(?:^|\/)pnpm-lock\.yaml$/u.test(file),
    message: '改动依赖或 lockfile，请在提交信息中补 `Dependency: <name> <reason>`。',
  },
  {
    name: 'Exception',
    test: (file) => /(?:^|\/)\.agents\/[a-z-]*exceptions\.json$/u.test(file),
    message: '改动例外清单，请在提交信息中补 `Exception: <id>`。',
  },
];

const messagePath = process.argv[2];
if (!messagePath) {
  process.stderr.write('用法: node scripts/check-commit-evidence.mjs <commit-message-file>\n');
  process.exit(1);
}

const message = readFileSync(messagePath, 'utf8');
if (/^(?:Merge|Revert)\b/u.test(message.trim())) {
  process.exit(0);
}

const files = execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

const missing = RULES.filter(
  (rule) => files.some((file) => rule.test(file)) && !new RegExp(`^${rule.name}:\\s*\\S`, 'mu').test(message),
);

if (missing.length === 0) {
  process.stdout.write('提交证据检查通过\n');
  process.exit(0);
}

process.stderr.write('提交信息缺少必要证据：\n');
for (const rule of missing) {
  process.stderr.write(`  - ${rule.message}\n`);
}
process.exit(1);
