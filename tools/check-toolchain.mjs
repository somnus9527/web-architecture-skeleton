#!/usr/bin/env node
/**
 * 工具链版本一致性检查。
 *
 * 骨架对 Node 与 pnpm 只承认两个权威来源：
 * 1. 各 `skeletons/<variant>/.nvmrc` 声明 Node 主版本，CI 通过 `node-version-file` 读取；
 * 2. 各 `skeletons/<variant>/package.json` 的 `packageManager` 声明 pnpm 版本，CI 通过
 *    `pnpm/action-setup` 的 `package_json_file` 读取。
 *
 * 本脚本保证四个变体、仓库根与全部 workflow 都与这两处声明一致，并拦截会退回 Node 20
 * 运行时的旧 Action major（`actions/checkout@v4` 等）。
 *
 * 升级工具链时改三处：下面的策略常量、各 `.nvmrc`、各 `package.json`；改完跑本脚本。
 *
 * 用法：node tools/check-toolchain.mjs
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SKELETON_ROOT = 'skeletons';

/** Node 主版本策略。 */
const NODE_MAJOR = '24';

/** pnpm 版本策略（不带 `pnpm@` 前缀）。 */
const PNPM_VERSION = '12.4.1';

/**
 * Action 允许的最低 major。这些 major 起 `runs.using` 为 node24，低于它会被 GitHub
 * 强制降级运行并刷 Node 20 弃用告警。
 */
const ACTION_MIN_MAJOR = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'pnpm/action-setup': 5,
};

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
 * 读取文本文件，缺失时返回空串。
 *
 * @param {string} relativePath - 相对仓库根的路径。
 * @returns {string} 文件内容。
 */
function readText(relativePath) {
  const absolute = join(ROOT, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
}

/**
 * 读取 JSON 文件，失败时返回 null。
 *
 * @param {string} relativePath - 相对仓库根的路径。
 * @returns {any} 解析结果。
 */
function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    fail(`${relativePath} 不是合法 JSON`);
    return null;
  }
}

/**
 * 列出一个目录下的条目名。
 *
 * @param {string} relativePath - 相对仓库根的目录。
 * @returns {import('node:fs').Dirent[]} 目录条目。
 */
function listDirectory(relativePath) {
  const absolute = join(ROOT, relativePath);
  return existsSync(absolute) ? readdirSync(absolute, { withFileTypes: true }) : [];
}

/**
 * 批量收集 workflow 文件。
 *
 * @returns {string[]} 相对仓库根的 workflow 路径。
 */
function listWorkflows() {
  const paths = listDirectory('.github/workflows')
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => `.github/workflows/${entry.name}`);

  for (const skeleton of listSkeletons()) {
    for (const entry of listDirectory(`${SKELETON_ROOT}/${skeleton}/.github/workflows`)) {
      if (entry.isFile() && /\.ya?ml$/u.test(entry.name)) {
        paths.push(`${SKELETON_ROOT}/${skeleton}/.github/workflows/${entry.name}`);
      }
    }
  }

  return paths.sort();
}

/**
 * 列出变体名（含 package.json 的 skeleton 目录）。
 *
 * @returns {string[]} 变体名。
 */
function listSkeletons() {
  return listDirectory(SKELETON_ROOT)
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, SKELETON_ROOT, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort();
}

/**
 * 取一行文本的缩进宽度。
 *
 * @param {string} line - 源码行。
 * @returns {number} 前导空格数。
 */
function indentOf(line) {
  return /^\s*/u.exec(line)[0].length;
}

/**
 * 把一个 workflow 拆成 step 文本块。
 *
 * @param {string} text - workflow 原文。
 * @returns {Array<{ index: number, lines: string[] }>} step 列表。
 */
function splitSteps(text) {
  const lines = text.split('\n');
  const starts = [];

  lines.forEach((line, index) => {
    if (/^\s*-\s+\S/u.test(line)) {
      starts.push({ index, indent: indentOf(line) });
    }
  });

  return starts.map((start, order) => {
    const next = starts[order + 1];
    const end = next && next.indent === start.indent ? next.index : lines.length;
    return { index: start.index, lines: lines.slice(start.index, end) };
  });
}

/**
 * 从 step 文本里取 `uses:` 的 action 名与 ref。
 *
 * @param {string[]} lines - step 文本行。
 * @returns {{ action: string, ref: string, line: string } | null} 解析结果。
 */
function parseUses(lines) {
  const line = lines.find((candidate) => /^\s*uses:/u.test(candidate));
  if (!line) {
    return null;
  }

  const match = /^\s*uses:\s*['"]?([\w.-]+\/[\w.-]+)@([\w.-]+)['"]?\s*$/u.exec(line);
  return match ? { action: match[1], ref: match[2], line } : null;
}

/**
 * 判断 step 文本里是否出现某个键（只看键，不看值）。
 *
 * @param {string[]} lines - step 文本行。
 * @param {string} key - 配置键名。
 * @returns {string | null} 命中行的去空格内容。
 */
function findKey(lines, key) {
  const pattern = new RegExp(`^\\s+${key}:\\s*(.*)$`, 'u');
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

const rootNvmrc = readText('.nvmrc').trim();
if (rootNvmrc !== NODE_MAJOR) {
  fail(`.nvmrc 应为 ${NODE_MAJOR}，实际 ${rootNvmrc || '缺失'}`);
}

const skeletons = listSkeletons();
if (skeletons.length === 0) {
  fail(`${SKELETON_ROOT}/ 下没有任何变体`);
}

for (const skeleton of skeletons) {
  const directory = `${SKELETON_ROOT}/${skeleton}`;
  const nvmrc = readText(`${directory}/.nvmrc`).trim();
  if (nvmrc !== NODE_MAJOR) {
    fail(`${directory}/.nvmrc 应为 ${NODE_MAJOR}，实际 ${nvmrc || '缺失'}`);
  }

  const manifest = readJson(`${directory}/package.json`) ?? {};
  const enginesNode = typeof manifest.engines?.node === 'string' ? manifest.engines.node : '';
  if (!enginesNode) {
    fail(`${directory}/package.json 缺少 engines.node`);
  } else if (!new RegExp(`(^|[^0-9])${NODE_MAJOR}([^0-9]|$)`, 'u').test(enginesNode)) {
    fail(`${directory}/package.json 的 engines.node=${enginesNode} 与 .nvmrc=${NODE_MAJOR} 不一致`);
  }

  const packageManager = typeof manifest.packageManager === 'string' ? manifest.packageManager : '';
  if (packageManager !== `pnpm@${PNPM_VERSION}`) {
    fail(`${directory}/package.json 的 packageManager 应为 pnpm@${PNPM_VERSION}，实际 ${packageManager || '缺失'}`);
  }
}

/**
 * 部署到服务器的变体必须带工具链安装脚本。
 *
 * 服务器上不允许裸装 pnpm（npm 的 latest tag 会漂，曾装出 pnpm 7），版本必须由脚本按
 * package.json 的 packageManager 精确安装并在装错时立刻失败。
 */
for (const skeleton of skeletons) {
  const directory = `${SKELETON_ROOT}/${skeleton}`;
  if (!existsSync(join(ROOT, directory, 'scripts', 'deploy.sh'))) {
    continue;
  }

  const installerPath = `${directory}/scripts/install-toolchain.sh`;
  const installer = readText(installerPath);
  if (!installer) {
    fail(`${installerPath} 缺失：服务器部署链路必须用脚本安装工具链`);
    continue;
  }
  if (!installer.includes('packageManager')) {
    fail(`${installerPath} 必须从 package.json 的 packageManager 读取 pnpm 版本`);
  }

  const code = installer
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  if (/pnpm@\d+\.\d+/u.test(code)) {
    fail(`${installerPath} 不得写死 pnpm 版本，版本只在 packageManager 声明`);
  }
}

for (const workflow of listWorkflows()) {
  const steps = splitSteps(readText(workflow));
  let sawSetupNode = false;

  for (const step of steps) {
    const uses = parseUses(step.lines);
    if (!uses) {
      continue;
    }

    const minimum = ACTION_MIN_MAJOR[uses.action];
    if (minimum !== undefined) {
      const major = /^v(\d+)/u.exec(uses.ref)?.[1];
      if (!major) {
        fail(`${workflow}: ${uses.action}@${uses.ref} 必须固定 major tag`);
      } else if (Number(major) < minimum) {
        fail(`${workflow}: ${uses.action}@${uses.ref} 低于 node24 运行时要求的 @v${minimum}`);
      }
    }

    if (uses.action === 'actions/setup-node') {
      sawSetupNode = true;
      if (findKey(step.lines, 'node-version') !== null) {
        fail(`${workflow}: 不得写死 node-version，改用 node-version-file 指向 .nvmrc`);
      }
      const versionFile = findKey(step.lines, 'node-version-file');
      if (versionFile === null) {
        fail(`${workflow}: actions/setup-node 缺少 node-version-file: .nvmrc`);
      } else if (!versionFile.replace(/^['"]|['"]$/gu, '').endsWith('.nvmrc')) {
        fail(`${workflow}: node-version-file 必须指向 .nvmrc，实际 ${versionFile}`);
      }
    }

    if (uses.action === 'pnpm/action-setup' && findKey(step.lines, 'version') !== null) {
      fail(`${workflow}: 不得写死 pnpm version，版本统一由 packageManager 声明`);
    }
  }

  if (!sawSetupNode) {
    fail(`${workflow}: 未找到 actions/setup-node`);
  }
}

if (failures.length === 0) {
  process.stdout.write(
    `工具链版本一致：Node ${NODE_MAJOR}、pnpm ${PNPM_VERSION}，覆盖 ${skeletons.length} 个变体与 ${listWorkflows().length} 个 workflow\n`,
  );
} else {
  process.stderr.write(`工具链版本检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exitCode = 1;
}
