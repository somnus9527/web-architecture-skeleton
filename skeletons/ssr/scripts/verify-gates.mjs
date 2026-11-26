#!/usr/bin/env node
/**
 * 校验当前项目是否具备骨架要求的门禁。
 *
 * 初始化完成、派生项目体检、CI 都可调用；缺任一项即退出码非 0。
 *
 * 用法：node scripts/verify-gates.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const results = [];

/**
 * 记录一项检查结果。
 *
 * @param {string} name - 检查项名称。
 * @param {boolean} passed - 是否通过。
 * @param {string} [detail] - 失败说明。
 * @returns {void}
 */
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
}

/**
 * 读取 JSON 文件，失败返回 null。
 *
 * @param {string} relativePath - 相对路径。
 * @returns {any} 解析结果。
 */
function readJson(relativePath) {
  const path = join(ROOT, relativePath);
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 列出匹配前缀的配置文件。
 *
 * @param {string} directory - 相对目录。
 * @param {RegExp} pattern - 文件名模式。
 * @returns {string[]} 文件路径。
 */
function listFiles(directory, pattern) {
  const absolute = join(ROOT, directory);
  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute)
    .filter((name) => pattern.test(name))
    .map((name) => join(directory, name));
}

/**
 * 判断 workflow 是否在 pnpm/action-setup 步骤里写死了 version。
 *
 * pnpm 版本只允许由 package.json 的 packageManager 声明，workflow 里再写一份必然漂移。
 *
 * @param {string} text - workflow 原文。
 * @returns {boolean} 是否写死。
 */
function hasPnpmVersionPin(text) {
  const lines = text.split('\n');

  return lines.some((line, index) => {
    if (!/^\s*(?:-\s*)?uses:\s*['"]?pnpm\/action-setup@/u.test(line)) {
      return false;
    }

    return lines.slice(index + 1, index + 6).some((next) => /^\s+version:/u.test(next));
  });
}

const packageJson = readJson('package.json') ?? {};
const scripts = packageJson.scripts ?? {};
const sourceConfig = readJson('.agents/architecture-source.json');
const variant = sourceConfig?.variant ?? sourceConfig?.architecture;
const isWebVariant = variant === 'spa' || variant === 'ssr';
const requiredScripts = [
  'typecheck',
  'lint',
  'test',
  'format:check',
  'quality:check',
  'check:hygiene',
  'check:gates',
  'env:init',
  ...(isWebVariant
    ? ['check:security', 'check:changed', 'check:architecture', 'check:seo', 'check:ui', 'check:logs']
    : []),
];

for (const script of requiredScripts) {
  check(`package.json 含 ${script}`, typeof scripts[script] === 'string');
}

check('packageManager 已固定', typeof packageJson.packageManager === 'string');

const enginesNode = typeof packageJson.engines?.node === 'string' ? packageJson.engines.node : '';
const nodeMajor = /(\d+)/u.exec(enginesNode)?.[1] ?? '';
const nvmrc = existsSync(join(ROOT, '.nvmrc')) ? readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim() : '';
check('package.json 声明 engines.node', Boolean(enginesNode), enginesNode);
check(
  '.nvmrc 与 engines.node 主版本一致',
  Boolean(nvmrc) && nvmrc === nodeMajor,
  `.nvmrc=${nvmrc || '缺失'} / engines.node=${enginesNode || '缺失'}`,
);

for (const script of ['check-repo-hygiene.mjs', 'verify-gates.mjs', 'init-local-env.mjs']) {
  check(`scripts/${script} 存在`, existsSync(join(ROOT, 'scripts', script)));
}
if (isWebVariant) {
  for (const script of [
    'check-security.mjs',
    'check-staged.mjs',
    'check-commit-evidence.mjs',
    'check-changed.mjs',
    'check-version-cache.mjs',
    'check-seo-routing.mjs',
    'check-seo-content.mjs',
    'check-seo-runtime.mjs',
    'check-ui-boundary.mjs',
    'check-logging.mjs',
    'check-i18n-copy.mjs',
    'check-a11y.mjs',
    'check-architecture-staged.mjs',
    'build.sh',
    'deploy.sh',
    'install-toolchain.sh',
  ]) {
    check(`scripts/${script} 存在`, existsSync(join(ROOT, 'scripts', script)));
  }
  check('package.json 含 build:release', typeof scripts['build:release'] === 'string');
  check('package.json 含 deploy', typeof scripts.deploy === 'string');
}

check('.repo-hygiene.json 存在', existsSync(join(ROOT, '.repo-hygiene.json')));

const preCommit = existsSync(join(ROOT, '.husky/pre-commit'))
  ? readFileSync(join(ROOT, '.husky/pre-commit'), 'utf8')
  : '';
check('pre-commit 调用卫生检查', /check-repo-hygiene|check-staged/u.test(preCommit));
if (isWebVariant) {
  check('pre-commit 调用分片安全检查', /check-staged/u.test(preCommit));

  const commitMsg = existsSync(join(ROOT, '.husky/commit-msg'))
    ? readFileSync(join(ROOT, '.husky/commit-msg'), 'utf8')
    : '';
  check('commit-msg 调用提交证据检查', /check-commit-evidence/u.test(commitMsg));

  const prePush = existsSync(join(ROOT, '.husky/pre-push')) ? readFileSync(join(ROOT, '.husky/pre-push'), 'utf8') : '';
  check('pre-push 调用增量检查', /check-changed/u.test(prePush));
  check('quality:check 串联安全扫描', /check:security/u.test(scripts['quality:check'] ?? ''));
}

const gateConfig = readJson('.repo-gates.json') ?? {};
const ciCommands = gateConfig.ciCommands ?? ['check:hygiene', 'check:gates', 'test', 'build'];

const workflows = listFiles('.github/workflows', /\.ya?ml$/u);
const workflowText = workflows.map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');
check('存在 CI workflow', workflows.length > 0);
for (const command of ciCommands) {
  check(`CI 包含 ${command}`, workflowText.includes(`pnpm ${command}`));
}
check('CI 不在 workflow 里写死 node-version', !/node-version:\s*['"]?\d/u.test(workflowText));
check('CI 用 node-version-file 读取 .nvmrc', /node-version-file:\s*['"]?[^\n]*\.nvmrc/u.test(workflowText));
check('CI 不写死 pnpm 版本（统一由 packageManager 声明）', !hasPnpmVersionPin(workflowText));

const eslintConfig = ['eslint.config.js', 'eslint.config.mjs'].find((file) => existsSync(join(ROOT, file)));
check('存在 ESLint 配置', Boolean(eslintConfig));
if (gateConfig.requireExplicitAnyRule !== false) {
  check(
    'ESLint 仍将 no-explicit-any 设为 error',
    Boolean(eslintConfig) &&
      /'@typescript-eslint\/no-explicit-any':\s*'error'/u.test(readFileSync(join(ROOT, eslintConfig), 'utf8')),
  );
}

const architectureTests = listFiles('src/test/architecture', /\.test\.tsx?$/u);
check('存在架构测试', architectureTests.length > 0);

const rules = listFiles('docs/rules', /\.md$/u);
check('存在 docs/rules', rules.length > 0);

check('architecture-source.json 已绑定变体', Boolean(variant));

const failed = results.filter((result) => !result.passed);
for (const result of results) {
  process.stdout.write(`${result.passed ? '✅' : '❌'} ${result.name}${result.detail ? `（${result.detail}）` : ''}\n`);
}
process.stdout.write(`\n门禁检查：${results.length - failed.length}/${results.length} 通过\n`);

if (failed.length > 0) {
  process.exitCode = 1;
}
