#!/usr/bin/env node
/**
 * UI 边界静态检查：业务不得直引组件库/图标库，不得使用原生交互标签，不得引入 Tailwind/MUI。
 *
 * 用法：node scripts/check-ui-boundary.mjs --staged
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

function allowedLibraryFile(relative) {
  return (
    relative === 'src/shared/ui/icons.ts' ||
    relative.startsWith('src/shared/ui/') ||
    relative === 'src/shared/theme/antd-theme.ts' ||
    relative === 'src/app/providers.tsx' ||
    relative.startsWith('src/app/providers/')
  );
}

function isBusinessSource(relative) {
  return (
    /^src\/(?:features|app|router)\/.+\.(?:ts|tsx)$/u.test(relative) &&
    !/\.test\.(?:ts|tsx)$/u.test(relative) &&
    !relative.startsWith('src/app/global-error.tsx') &&
    !relative.startsWith('src/app/error.tsx')
  );
}

function checkSource(relative) {
  const file = join(process.cwd(), relative);
  if (!existsSync(file)) return;
  const source = readFileSync(file, 'utf8');

  if (!allowedLibraryFile(relative)) {
    if (/from\s+['"](?:antd|@ant-design\/icons|@ant-design\/nextjs-registry)['"]/u.test(source)) {
      fail(`${relative}: 只能从 @/shared/ui 导入 UI，不能直接引 antd`);
    }
    if (/from\s+['"]lucide-react['"]/u.test(source)) {
      fail(`${relative}: 只能从 @/shared/ui 导入图标，不能直接引 lucide-react`);
    }
  }

  if (/from\s+['"](?:@mui\/|@emotion\/)/u.test(source)) fail(`${relative}: 禁止 MUI/Emotion`);
  if (/@import\s+['"]tailwindcss['"]/u.test(source)) fail(`${relative}: 禁止 Tailwind`);

  if (isBusinessSource(relative) && /<(?:button|input|select|textarea|dialog|table)\b/u.test(source)) {
    fail(`${relative}: 业务层禁止原生交互标签，请使用 @/shared/ui`);
  }
}

const packageJson = join(process.cwd(), 'package.json');
if (existsSync(packageJson)) {
  const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const forbidden = names.filter((name) => /^(?:@mui\/|@emotion\/|tailwindcss$|@tailwindcss\/)/u.test(name));
  if (forbidden.length > 0) fail(`package.json 仍包含禁止依赖: ${forbidden.join(', ')}`);
}

const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--tracked') ? 'tracked' : 'files';
const files = filesFor(mode).map((file) => file.replaceAll('\\', '/'));
const relevant = files.filter((file) => /^src\/.+\.(?:ts|tsx)$/u.test(file) || file === 'package.json');

if (mode !== 'tracked' && relevant.length === 0) {
  process.stdout.write('UI 边界检查：未涉及 UI 源码，跳过\n');
  process.exit(0);
}

for (const file of relevant.filter((file) => file !== 'package.json')) checkSource(file);

if (failures.length > 0) {
  process.stderr.write(`UI 边界检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}

process.stdout.write('UI 边界静态检查通过\n');
