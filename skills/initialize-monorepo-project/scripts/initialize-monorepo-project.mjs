#!/usr/bin/env node
/**
 * 生成 monorepo 项目：复制 workspace 骨架，并把各类型应用骨架装进 apps/<name>。
 *
 * 必须在骨架仓库内运行（需要同时读取 skeletons/monorepo 与 skeletons/<variant>）。
 *
 * 用法：
 *   node skills/initialize-monorepo-project/scripts/initialize-monorepo-project.mjs \
 *     --id acme --target ../acme --app spa:web --app ssr:site [--no-install] [--dry-run]
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../../..');
const MONOREPO_SKELETON = join(REPOSITORY_ROOT, 'skeletons', 'monorepo');
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** 只在 workspace 根保留、应用内必须剥离的条目。 */
const WORKSPACE_ONLY_ENTRIES = new Set([
  '.github',
  '.husky',
  '.prettierrc.json',
  '.prettierignore',
  '.editorconfig',
  'commitlint.config.cjs',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'README.md',
  'AGENTS.md',
  '.gitignore',
  '.repo-hygiene.json',
  'node_modules',
  '.next',
  'dist',
  'next-env.d.ts',
  'tsconfig.tsbuildinfo',
]);

/** 构建产物与本地文件不随骨架复制。 */
const BUILD_ARTIFACTS = new Set(['node_modules', '.next', 'dist', 'next-env.d.ts', 'tsconfig.tsbuildinfo']);

/** 本地环境文件不随骨架复制，只保留 *.example 与模板自带的 .env.mock。 */
const LOCAL_ENV_FILE = /^\.env(?:\.(?:dev|test|prod|local))?$/u;

/** 由 workspace 根统一接管的 npm scripts。 */
const HOISTED_SCRIPTS = ['prepare', 'quality:check', 'check:hygiene', 'check:gates'];

/**
 * 解析命令行参数。
 *
 * @returns {{dryRun: boolean, install: boolean, id: string, target: string, apps: Array<{variant: string, name: string}>}} 参数。
 */
function parseArguments() {
  const argumentList = process.argv.slice(2);
  let dryRun = false;
  let install = true;
  let id;
  let target;
  const apps = [];

  for (let index = 0; index < argumentList.length; index += 1) {
    const argument = argumentList[index];
    if (argument === '--dry-run') {
      dryRun = true;
    } else if (argument === '--no-install') {
      install = false;
    } else if (argument === '--id' || argument === '--target' || argument === '--app') {
      const value = argumentList[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} 必须提供取值。`);
      }
      if (argument === '--id') {
        id = value;
      } else if (argument === '--target') {
        target = value;
      } else {
        const separator = value.indexOf(':');
        if (separator <= 0 || separator === value.length - 1) {
          throw new Error(`--app 必须是 <variant>:<name>：${value}`);
        }
        apps.push({ variant: value.slice(0, separator), name: value.slice(separator + 1) });
      }
      index += 1;
    } else {
      throw new Error(`未知参数: ${argument}`);
    }
  }

  if (!id || !KEBAB_CASE.test(id)) {
    throw new Error('--id 必须是 kebab-case 项目名。');
  }
  if (!target) {
    throw new Error('--target 必须提供目标目录。');
  }
  for (const app of apps) {
    if (!KEBAB_CASE.test(app.name)) {
      throw new Error(`应用名必须是 kebab-case：${app.name}`);
    }
    if (!existsSync(join(REPOSITORY_ROOT, 'manifests', `${app.variant}.json`))) {
      throw new Error(`未知变体：${app.variant}`);
    }
    if (app.variant === 'monorepo') {
      throw new Error('monorepo 不能嵌套 monorepo。');
    }
  }

  const duplicated = new Set();
  for (const app of apps) {
    if (duplicated.has(app.name)) {
      throw new Error(`应用名重复：${app.name}`);
    }
    duplicated.add(app.name);
  }

  return { dryRun, install, id, target: resolve(process.cwd(), target), apps };
}

/**
 * 判断某个骨架条目是否应复制进应用目录。
 *
 * @param {string} skeletonRoot - 骨架根目录。
 * @param {string} source - 待判断的绝对路径。
 * @returns {boolean} 是否复制。
 */
function keepEntry(skeletonRoot, source) {
  const relativePath = relative(skeletonRoot, source);
  if (!relativePath) {
    return true;
  }

  const [first] = relativePath.split('/');
  if (BUILD_ARTIFACTS.has(first)) {
    return false;
  }
  if (LOCAL_ENV_FILE.test(relativePath)) {
    return false;
  }

  return true;
}

/**
 * 把一个变体骨架复制进 apps/<name>。
 *
 * @param {string} variant - 变体名。
 * @param {string} destination - 目标应用目录。
 * @returns {void}
 */
function copyVariantSkeleton(variant, destination) {
  const source = join(REPOSITORY_ROOT, 'skeletons', variant);
  cpSync(source, destination, { recursive: true, filter: (entry) => keepEntry(source, entry) });
}

/**
 * 剥离应用内的根级配置与夹具文件。
 *
 * 必须在变体初始化脚本之后执行：初始化脚本会改写 README、AGENTS.md 与 CI workflow。
 *
 * @param {string} appDirectory - 应用目录。
 * @returns {void}
 */
function stripWorkspaceOnlyEntries(appDirectory) {
  for (const entry of WORKSPACE_ONLY_ENTRIES) {
    const path = join(appDirectory, entry);
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  }
}

/**
 * 运行应用自己的初始化脚本，完成身份替换。
 *
 * @param {{variant: string, name: string}} app - 应用定义。
 * @param {string} appDirectory - 应用目录。
 * @param {string} projectId - 应用的项目 ID（也是包名）。
 * @param {boolean} dryRun - 是否干跑。
 * @returns {void}
 */
function runVariantInitializer(app, appDirectory, projectId, dryRun) {
  const script = join(
    appDirectory,
    '.agents',
    'skills',
    `initialize-${app.variant}-project`,
    'scripts',
    `initialize-${app.variant}-project.mjs`,
  );
  if (!existsSync(script)) {
    throw new Error(`${app.variant} 骨架缺少初始化脚本：${script}`);
  }

  const args = [script];
  if (dryRun) {
    args.push('--dry-run');
  }
  if (app.variant === 'spa' || app.variant === 'ssr') {
    args.push('--no-backend', '--package-name', projectId);
  }
  args.push(projectId);

  const result = spawnSync(process.execPath, args, { cwd: appDirectory, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`initialize-${app.variant}-project 失败：${app.name}`);
  }
}

/**
 * 读取 workspace catalog 声明的依赖名。
 *
 * @returns {Set<string>} catalog 键集合。
 */
function listCatalogKeys() {
  const source = readFileSync(join(MONOREPO_SKELETON, 'pnpm-workspace.yaml'), 'utf8');
  const keys = new Set();
  let inCatalog = false;

  for (const line of source.split('\n')) {
    if (/^catalog:\s*$/u.test(line)) {
      inCatalog = true;
      continue;
    }
    if (inCatalog && /^\S/u.test(line)) {
      inCatalog = false;
    }
    const match = inCatalog ? /^ {2}'?([^':]+)'?:\s/u.exec(line) : null;
    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
}

/**
 * 让应用 ESLint 配置继承 workspace 根基线，应用只追加自己的插件规则。
 *
 * @param {string} appDirectory - 应用目录。
 * @returns {void}
 */
function inheritEslint(appDirectory) {
  for (const file of ['eslint.config.js', 'eslint.config.mjs']) {
    const path = join(appDirectory, file);
    if (!existsSync(path)) {
      continue;
    }

    let content = readFileSync(path, 'utf8');
    if (content.includes('../../eslint.config.mjs')) {
      continue;
    }

    content = content.replace(/^import js from '@eslint\/js';\n/mu, '');
    content = content.replace(/^ {2}js\.configs\.recommended,\n/mu, '');
    content = content.replace(/^ {2}\.\.\.tseslint\.configs\.recommended,\n/mu, '');

    const lines = content.split('\n');
    let lastImport = -1;
    lines.forEach((line, index) => {
      if (line.startsWith('import ')) {
        lastImport = index;
      }
    });
    lines.splice(lastImport + 1, 0, "import sharedEslintConfig from '../../eslint.config.mjs';");
    content = lines.join('\n');

    content = content.replace(
      'export default tseslint.config(\n',
      'export default tseslint.config(\n  ...sharedEslintConfig,\n',
    );
    writeFileSync(path, content);
  }
}

/**
 * 把应用 package.json 收敛到 workspace 约定。
 *
 * @param {string} appDirectory - 应用目录。
 * @returns {void}
 */
function normalizeAppManifest(appDirectory) {
  const path = join(appDirectory, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const catalogKeys = listCatalogKeys();

  manifest.private = true;

  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (catalogKeys.has(name) && !String(version).startsWith('catalog:')) {
        manifest[section][name] = 'catalog:';
      }
    }
  }

  for (const script of HOISTED_SCRIPTS) {
    delete manifest.scripts?.[script];
  }
  delete manifest['lint-staged'];

  for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
    if (typeof script === 'string' && script.includes('prettier')) {
      manifest.scripts[name] = script.replace(/(?<!ignore-path )\bprettier\b/u, 'prettier --ignore-path ../../.prettierignore');
    }
  }

  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * 让应用 tsconfig 继承 workspace 基线，并只保留应用需要的差异。
 *
 * @param {string} appDirectory - 应用目录。
 * @returns {void}
 */
function inheritTsconfig(appDirectory) {
  for (const file of readdirSync(appDirectory).filter((name) => /^tsconfig.*\.json$/u.test(name))) {
    const path = join(appDirectory, file);
    let content = readFileSync(path, 'utf8');
    if (content.includes('../../tsconfig.base.json')) {
      continue;
    }

    if (content.includes('"compilerOptions": {')) {
      content = content.replace(
        '"compilerOptions": {',
        '"compilerOptions": {\n    "noUncheckedIndexedAccess": false,\n    "exactOptionalPropertyTypes": false,\n    "verbatimModuleSyntax": false,\n    "noImplicitOverride": false,',
      );
    }
    content = content.replace(/^\{/u, '{\n  "extends": "../../tsconfig.base.json",');

    writeFileSync(path, content);
  }
}

/**
 * 替换 workspace 根的身份标识。
 *
 * @param {string} target - 目标目录。
 * @param {string} id - 项目 ID。
 * @returns {void}
 */
function initializeWorkspaceRoot(target, id) {
  const manifestPath = join(target, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.name = id;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const readmePath = join(target, 'README.md');
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf8').replace(/^# .+$/mu, `# ${id}`);
    writeFileSync(readmePath, readme);
  }

  const agentsPath = join(target, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const agents = readFileSync(agentsPath, 'utf8').replaceAll('`monorepo-app`', `\`${id}\``);
    writeFileSync(agentsPath, agents);
  }
}

const { dryRun, install, id, target, apps } = parseArguments();

if (!existsSync(MONOREPO_SKELETON)) {
  throw new Error(`找不到 ${MONOREPO_SKELETON}，请在骨架仓库内运行本脚本。`);
}
if (existsSync(target) && readdirSync(target).length > 0) {
  throw new Error(`目标目录不是空的：${target}`);
}

if (dryRun) {
  process.stdout.write(`[dry-run] workspace: ${id} -> ${target}\n`);
  for (const app of apps) {
    process.stdout.write(`[dry-run] app: ${app.variant} -> apps/${app.name} (${id}-${app.name})\n`);
  }
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(MONOREPO_SKELETON, target, { recursive: true });

// 模板不带锁文件：目标的应用集合不同，必须由目标仓库自行解析。
rmSync(join(target, 'pnpm-lock.yaml'), { force: true });

const exampleApp = join(target, 'apps', 'example-app');
if (existsSync(exampleApp) && statSync(exampleApp).isDirectory()) {
  rmSync(exampleApp, { recursive: true, force: true });
}

for (const app of apps) {
  const appDirectory = join(target, 'apps', app.name);
  const projectId = `${id}-${app.name}`;

  copyVariantSkeleton(app.variant, appDirectory);
  runVariantInitializer(app, appDirectory, projectId, false);
  stripWorkspaceOnlyEntries(appDirectory);
  normalizeAppManifest(appDirectory);
  inheritEslint(appDirectory);
  inheritTsconfig(appDirectory);
  process.stdout.write(`已初始化 apps/${app.name}（${app.variant}，${projectId}）\n`);
}

initializeWorkspaceRoot(target, id);

if (install) {
  const result = spawnSync('pnpm', ['install'], { cwd: target, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    throw new Error('pnpm install 失败。');
  }
}

process.stdout.write(`\n完成：${target}\n下一步：cd ${target} && pnpm install && pnpm check\n`);
