#!/usr/bin/env node
/**
 * 初始化冒烟测试。
 *
 * 对每个变体复制一份骨架到临时目录，运行真实初始化，再断言：
 * 1. 初始化脚本能跑完（文档锚点没有失配）；
 * 2. 生成物里没有已下线的后端规则与模板仓引用；
 * 3. 生成物仍能通过门禁自检。
 *
 * 用法：node tools/check-init-smoke.mjs
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PROJECT_ID = 'init-smoke-app';

/**
 * 已下线资源的引用模式：按 D7 后端规则不再分发。
 */
const FORBIDDEN_PATTERNS = [
  { pattern: 'docs/rules/backend', reason: 'Java 后端规则已不再分发' },
  { pattern: 'docs/rules/next-backend', reason: 'Next 后端规则已不再分发' },
  { pattern: 'backend-architecture-skeleton', reason: '后端模板仓已不再作为前置依赖' },
];

/**
 * 各变体的初始化参数。
 */
const VARIANTS = {
  spa: { script: 'initialize-spa-project/scripts/initialize-spa-project.mjs', args: ['--no-backend', PROJECT_ID] },
  ssr: {
    script: 'initialize-ssr-project/scripts/initialize-ssr-project.mjs',
    args: ['--no-backend', PROJECT_ID],
  },
  rn: {
    script: 'initialize-rn-project/scripts/initialize-rn-project.mjs',
    args: [PROJECT_ID],
  },
};

/**
 * 递归收集 markdown 文件。
 *
 * @param {string} directory - 目录绝对路径。
 * @returns {string[]} 文件绝对路径。
 */
function listMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMarkdown(absolute);
    }
    return entry.name.endsWith('.md') ? [absolute] : [];
  });
}

/**
 * 在一个变体上执行冒烟测试。
 *
 * @param {string} variant - 变体名。
 * @returns {string[]} 失败描述。
 */
function checkVariant(variant) {
  const config = VARIANTS[variant];
  const failures = [];
  const workdir = mkdtempSync(join(tmpdir(), `skeleton-${variant}-`));

  try {
    cpSync(join(ROOT, 'skeletons', variant), workdir, { recursive: true });

    const script = join(workdir, '.agents', 'skills', config.script);
    if (!existsSync(script)) {
      return [`${variant}: 缺少初始化脚本 ${config.script}`];
    }

    try {
      execFileSync(process.execPath, [script, ...config.args], { cwd: workdir, stdio: 'pipe' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return [`${variant}: 初始化失败 ${detail.split('\n')[0]}`];
    }

    for (const file of listMarkdown(workdir)) {
      const content = readFileSync(file, 'utf8');
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (content.includes(pattern)) {
          failures.push(`${variant}: ${file.slice(workdir.length + 1)} 仍引用 ${pattern}（${reason}）`);
        }
      }
    }

    try {
      execFileSync(process.execPath, [join(workdir, 'scripts', 'verify-gates.mjs')], {
        cwd: workdir,
        stdio: 'pipe',
      });
    } catch {
      failures.push(`${variant}: 初始化产物未通过门禁自检`);
    }

    return failures;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

/**
 * monorepo 组合生成冒烟测试：生成 spa + ssr 两个应用，校验继承与剥离结果。
 *
 * @returns {string[]} 失败描述。
 */
function checkMonorepo() {
  const failures = [];
  const workdir = mkdtempSync(join(tmpdir(), 'skeleton-monorepo-'));
  const target = join(workdir, 'smoke-mono');

  try {
    execFileSync(
      process.execPath,
      [
        join(ROOT, 'skills', 'initialize-monorepo-project', 'scripts', 'initialize-monorepo-project.mjs'),
        '--id',
        'smoke-mono',
        '--target',
        target,
        '--app',
        'spa:web',
        '--app',
        'ssr:site',
        '--no-install',
      ],
      { cwd: ROOT, stdio: 'pipe' },
    );

    const rootManifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
    if (rootManifest.name !== 'smoke-mono') {
      failures.push('monorepo: 根 package.json 名称未替换');
    }
    if (existsSync(join(target, 'apps', 'example-app'))) {
      failures.push('monorepo: example-app 夹具未被删除');
    }

    for (const [directory, expectedName] of [
      ['apps/web', 'smoke-mono-web'],
      ['apps/site', 'smoke-mono-site'],
    ]) {
      const appDirectory = join(target, directory);
      const manifest = JSON.parse(readFileSync(join(appDirectory, 'package.json'), 'utf8'));
      if (manifest.name !== expectedName) {
        failures.push(`${directory}: 包名应为 ${expectedName}，实际 ${manifest.name}`);
      }
      if (manifest.private !== true) {
        failures.push(`${directory}: 必须声明 private: true`);
      }
      for (const hoisted of [
        '.github',
        '.husky',
        '.nvmrc',
        '.prettierrc.json',
        '.editorconfig',
        'README.md',
        'AGENTS.md',
        'pnpm-lock.yaml',
      ]) {
        if (existsSync(join(appDirectory, hoisted))) {
          failures.push(`${directory}: 根级配置 ${hoisted} 未被剥离`);
        }
      }
    }

    const appTsconfigs = readdirSync(join(target, 'apps', 'web')).filter((name) => /^tsconfig.*\.json$/u.test(name));
    const inherited = appTsconfigs.some((name) =>
      readFileSync(join(target, 'apps', 'web', name), 'utf8').includes('../../tsconfig.base.json'),
    );
    if (!inherited) {
      failures.push('apps/web: tsconfig 未继承 ../../tsconfig.base.json');
    }

    try {
      execFileSync(process.execPath, [join(target, 'scripts', 'check-workspace.mjs')], { cwd: target, stdio: 'pipe' });
    } catch {
      failures.push('monorepo: workspace 边界校验未通过');
    }

    return failures;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

const failures = [...Object.keys(VARIANTS).flatMap(checkVariant), ...checkMonorepo()];

if (failures.length === 0) {
  process.stdout.write(`初始化冒烟测试通过：${Object.keys(VARIANTS).join('、')}、monorepo\n`);
} else {
  process.stderr.write(`初始化冒烟测试失败（${failures.length} 项）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exitCode = 1;
}
