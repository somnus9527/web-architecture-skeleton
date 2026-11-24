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

const packageJson = readJson('package.json') ?? {};
const scripts = packageJson.scripts ?? {};
const requiredScripts = [
  'typecheck',
  'lint',
  'test',
  'format:check',
  'quality:check',
  'check:hygiene',
  'check:gates',
  'env:init',
];

for (const script of requiredScripts) {
  check(`package.json 含 ${script}`, typeof scripts[script] === 'string');
}

check('packageManager 已固定', typeof packageJson.packageManager === 'string');

for (const script of ['check-repo-hygiene.mjs', 'verify-gates.mjs', 'init-local-env.mjs']) {
  check(`scripts/${script} 存在`, existsSync(join(ROOT, 'scripts', script)));
}

check('.repo-hygiene.json 存在', existsSync(join(ROOT, '.repo-hygiene.json')));

const preCommit = existsSync(join(ROOT, '.husky/pre-commit'))
  ? readFileSync(join(ROOT, '.husky/pre-commit'), 'utf8')
  : '';
check('pre-commit 调用卫生检查', /check-repo-hygiene/u.test(preCommit));

const workflows = listFiles('.github/workflows', /\.ya?ml$/u);
const workflowText = workflows.map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');
check('存在 CI workflow', workflows.length > 0);
for (const command of ['check:hygiene', 'check:gates', 'test', 'build']) {
  check(`CI 包含 ${command}`, workflowText.includes(`pnpm ${command}`));
}

const eslintConfig = ['eslint.config.js', 'eslint.config.mjs'].find((file) => existsSync(join(ROOT, file)));
check('存在 ESLint 配置', Boolean(eslintConfig));
check(
  'ESLint 仍将 no-explicit-any 设为 error',
  Boolean(eslintConfig) &&
    /'@typescript-eslint\/no-explicit-any':\s*'error'/u.test(readFileSync(join(ROOT, eslintConfig), 'utf8')),
);

const architectureTests = listFiles('src/test/architecture', /\.test\.ts$/u);
check('存在架构测试', architectureTests.length > 0);

const rules = listFiles('docs/rules', /\.md$/u);
check('存在 docs/rules', rules.length > 0);

const sourceConfig = readJson('.agents/architecture-source.json');
check('architecture-source.json 已绑定变体', Boolean(sourceConfig?.variant ?? sourceConfig?.architecture));

const failed = results.filter((result) => !result.passed);
for (const result of results) {
  process.stdout.write(`${result.passed ? '✅' : '❌'} ${result.name}${result.detail ? `（${result.detail}）` : ''}\n`);
}
process.stdout.write(`\n门禁检查：${results.length - failed.length}/${results.length} 通过\n`);

if (failed.length > 0) {
  process.exitCode = 1;
}
