#!/usr/bin/env node
/**
 * workspace 结构校验。
 *
 * 校验 monorepo 的包边界、catalog 使用与聚合脚本约定，防止模板被改成跑不起来的死代码。
 *
 * 用法：node scripts/check-workspace.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const failures = [];

/**
 * 记录一条失败。
 *
 * @param {string} message - 失败描述。
 * @returns {void}
 */
function fail(message) {
  failures.push(message);
}

/**
 * 读取 JSON 文件。
 *
 * @param {string} relativePath - 相对仓库根的路径。
 * @returns {Record<string, unknown> | null} 解析结果。
 */
function readJson(relativePath) {
  const absolute = join(ROOT, relativePath);
  return existsSync(absolute) ? JSON.parse(readFileSync(absolute, 'utf8')) : null;
}

/**
 * 列出某个域下的包。
 *
 * @param {string} domain - apps 或 packages。
 * @returns {Array<{dir: string, name: string, manifest: Record<string, unknown>}>} 包列表。
 */
function listWorkspace(domain) {
  const absolute = join(ROOT, domain);
  if (!existsSync(absolute)) {
    fail(`缺少 ${domain}/ 目录`);
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      dir: `${domain}/${entry.name}`,
      manifest: readJson(`${domain}/${entry.name}/package.json`),
    }))
    .filter((entry) => {
      if (!entry.manifest) {
        fail(`${entry.dir} 缺少 package.json`);
        return false;
      }

      return true;
    })
    .map((entry) => ({ ...entry, name: String(entry.manifest.name) }));
}

const apps = listWorkspace('apps');
const packages = listWorkspace('packages');
const workspaceNames = new Set([...apps, ...packages].map((entry) => entry.name));

/**
 * 从 pnpm-workspace.yaml 中提取 catalog 键，避免引入 YAML 依赖。
 *
 * @returns {Set<string>} catalog 里声明的依赖名。
 */
function listCatalogKeys() {
  const source = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
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

const catalogKeys = listCatalogKeys();
if (catalogKeys.size === 0) {
  fail('pnpm-workspace.yaml 没有声明 catalog');
}

/**
 * 校验某个包的依赖边界。
 *
 * @param {{dir: string, name: string, manifest: Record<string, unknown>}} entry - 包条目。
 * @param {string} domain - apps 或 packages。
 * @returns {void}
 */
function checkDependencies(entry, domain) {
  const dependencies = { ...entry.manifest.dependencies, ...entry.manifest.devDependencies };

  for (const [name, version] of Object.entries(dependencies)) {
    if (name.startsWith('@repo/') || workspaceNames.has(name)) {
      if (!String(version).startsWith('workspace:')) {
        fail(`${entry.dir}: 内部依赖 ${name} 必须使用 workspace: 协议`);
      }
      continue;
    }

    if (catalogKeys.has(name) && version !== 'catalog:') {
      fail(`${entry.dir}: ${name} 已在 catalog 中，必须使用 catalog: 而不是 ${String(version)}`);
    }
  }

  if (domain === 'packages') {
    for (const [name, version] of Object.entries(dependencies)) {
      if (apps.some((app) => app.name === name)) {
        fail(`${entry.dir}: 共享包不得依赖应用 ${name}`);
      }
      if (name.startsWith('@repo/') && !String(version).startsWith('workspace:')) {
        fail(`${entry.dir}: 内部依赖 ${name} 必须使用 workspace: 协议`);
      }
    }
  }

  if (entry.name === '@repo/types') {
    const internal = Object.keys(dependencies).filter((name) => name.startsWith('@repo/'));
    if (internal.length > 0) {
      fail(`${entry.dir}: packages/types 不得依赖其它 workspace 包（${internal.join(', ')}）`);
    }
  }
}

/**
 * 校验包的脚本与入口声明。
 *
 * @param {{dir: string, name: string, manifest: Record<string, unknown>}} entry - 包条目。
 * @param {string} domain - apps 或 packages。
 * @returns {void}
 */
function checkScriptsAndExports(entry, domain) {
  const scripts = entry.manifest.scripts ?? {};
  for (const script of ['typecheck', 'test']) {
    if (typeof scripts[script] !== 'string') {
      fail(`${entry.dir}: 缺少 ${script} 脚本`);
    }
  }

  if (domain === 'apps') {
    for (const script of ['dev', 'build']) {
      if (typeof scripts[script] !== 'string') {
        fail(`${entry.dir}: 应用缺少 ${script} 脚本`);
      }
    }
    if (entry.manifest.private !== true) {
      fail(`${entry.dir}: 应用必须声明 private: true`);
    }

    return;
  }

  if (!entry.manifest.exports || Object.keys(entry.manifest.exports).length === 0) {
    fail(`${entry.dir}: 共享包必须声明 exports 入口`);
  }
  for (const entrypoint of Object.keys(entry.manifest.exports ?? {})) {
    if (!entrypoint.includes('/') && entrypoint !== '.') {
      fail(`${entry.dir}: exports 键 ${entrypoint} 不合法`);
    }
  }
}

/**
 * 校验应用从 workspace 根继承工具链配置，而不是各自保留仓库级副本。
 *
 * @param {{dir: string, name: string}} entry - 应用条目。
 * @returns {void}
 */
function checkInheritance(entry) {
  const hoisted = [
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
  ];

  for (const name of hoisted) {
    if (existsSync(join(ROOT, entry.dir, name))) {
      fail(`${entry.dir}: ${name} 由 workspace 根统一提供，应用内不得保留副本`);
    }
  }

  const tsconfig = readJson(`${entry.dir}/tsconfig.json`);
  if (!tsconfig) {
    fail(`${entry.dir}: 缺少 tsconfig.json`);
    return;
  }
  if (tsconfig.extends !== '../../tsconfig.base.json') {
    fail(`${entry.dir}: tsconfig.json 必须 extends ../../tsconfig.base.json`);
  }
}

for (const entry of apps) {
  checkDependencies(entry, 'apps');
  checkScriptsAndExports(entry, 'apps');
  checkInheritance(entry);
}
for (const entry of packages) {
  checkDependencies(entry, 'packages');
  checkScriptsAndExports(entry, 'packages');
}

const rootManifest = readJson('package.json') ?? {};
if (rootManifest.private !== true) {
  fail('根 package.json 必须声明 private: true');
}
for (const script of ['check', 'typecheck', 'lint', 'test', 'format:check', 'build']) {
  if (typeof rootManifest.scripts?.[script] !== 'string') {
    fail(`根 package.json 缺少 ${script} 聚合脚本`);
  }
}

if (failures.length === 0) {
  process.stdout.write(`workspace 校验通过：${apps.length} 个应用、${packages.length} 个共享包\n`);
} else {
  process.stderr.write(`workspace 校验失败（${failures.length} 项）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exitCode = 1;
}
