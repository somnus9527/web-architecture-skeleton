#!/usr/bin/env node
/**
 * 初始化 Expo RN 项目骨架。
 *
 * 用法：
 *   node initialize-rn-project.mjs [--dry-run] <project-id>
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const ROOT_DIRECTORY = resolve(SCRIPT_DIRECTORY, '../../../..');
const PLACEHOLDER_PACKAGE_NAME = 'rn-app';
const PLACEHOLDER_DISPLAY_NAME = 'RN Application';
const PLACEHOLDER_SCHEME = 'rnapp';
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/**
 * 读取 CLI 参数。
 *
 * @returns {{dryRun: boolean, projectId: string}} 解析结果。
 */
function parseArguments() {
  const arguments_ = process.argv.slice(2);
  const dryRun = arguments_.includes('--dry-run');
  const positional = arguments_.filter((argument) => !argument.startsWith('--'));

  if (positional.length !== 1) {
    throw new Error('用法: node initialize-rn-project.mjs [--dry-run] <project-id>');
  }

  const [projectId] = positional;
  if (!KEBAB_CASE.test(projectId)) {
    throw new Error(`项目名必须是 kebab-case: ${projectId}`);
  }

  return { dryRun, projectId };
}

/**
 * 把 kebab-case 转为展示名。
 *
 * @param {string} projectId - kebab-case 项目名。
 * @returns {string} Title Case 展示名。
 */
function toDisplayName(projectId) {
  return projectId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * 读取 JSON 文件。
 *
 * @param {string} relativePath - 相对项目根的路径。
 * @returns {Record<string, unknown>} 解析结果。
 */
function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8'));
}

/**
 * 读取文本文件。
 *
 * @param {string} relativePath - 相对项目根的路径。
 * @returns {string} 文件内容。
 */
function readText(relativePath) {
  return readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8');
}

/**
 * 写入文本文件；dry-run 时只记录不落盘。
 *
 * @param {string} relativePath - 相对项目根的路径。
 * @param {string} content - 新内容。
 * @param {boolean} dryRun - 是否只演练。
 * @param {string[]} changedFiles - 变更文件收集器。
 * @returns {void}
 */
function writeText(relativePath, content, dryRun, changedFiles) {
  const current = existsSync(join(ROOT_DIRECTORY, relativePath)) ? readText(relativePath) : null;
  if (current === content) {
    return;
  }

  changedFiles.push(relativePath);
  if (!dryRun) {
    writeFileSync(join(ROOT_DIRECTORY, relativePath), content, 'utf8');
  }
}

/**
 * 断言当前仓库仍是未经初始化的 RN 骨架。
 *
 * @returns {void}
 */
function assertPristineSkeleton() {
  const packageJson = readJson('package.json');
  const appConfig = readJson('app.json');

  if (
    packageJson.name !== PLACEHOLDER_PACKAGE_NAME ||
    appConfig.expo?.name !== PLACEHOLDER_DISPLAY_NAME ||
    appConfig.expo?.slug !== PLACEHOLDER_PACKAGE_NAME
  ) {
    throw new Error('当前仓库不是可直接初始化的 RN 骨架，或已经完成/部分初始化。');
  }
}

/**
 * 替换必须存在的文本片段。
 *
 * @param {string} source - 原文本。
 * @param {string} from - 待替换片段。
 * @param {string} to - 替换结果。
 * @param {string} file - 文件名，用于报错。
 * @returns {string} 替换后的文本。
 */
function replaceRequired(source, from, to, file) {
  if (!source.includes(from)) {
    throw new Error(`初始化目标结构已变化: ${file}`);
  }

  return source.replace(from, to);
}

/**
 * 更新 package.json 的应用名。
 *
 * @param {{projectId: string}} values - 派生值。
 * @param {boolean} dryRun - 是否只演练。
 * @param {string[]} changedFiles - 变更文件收集器。
 * @returns {void}
 */
function updatePackageJson(values, dryRun, changedFiles) {
  const source = readText('package.json');
  const updated = replaceRequired(
    source,
    `"name": "${PLACEHOLDER_PACKAGE_NAME}"`,
    `"name": "${values.projectId}"`,
    'package.json',
  );
  writeText('package.json', updated, dryRun, changedFiles);
}

/**
 * 更新 app.json 的名称、slug 与 scheme。
 *
 * @param {{projectId: string, displayName: string, scheme: string}} values - 派生值。
 * @param {boolean} dryRun - 是否只演练。
 * @param {string[]} changedFiles - 变更文件收集器。
 * @returns {void}
 */
function updateAppConfig(values, dryRun, changedFiles) {
  let source = readText('app.json');
  source = replaceRequired(
    source,
    `"name": "${PLACEHOLDER_DISPLAY_NAME}"`,
    `"name": "${values.displayName}"`,
    'app.json',
  );
  source = replaceRequired(
    source,
    `"slug": "${PLACEHOLDER_PACKAGE_NAME}"`,
    `"slug": "${values.projectId}"`,
    'app.json',
  );
  source = replaceRequired(source, `"scheme": "${PLACEHOLDER_SCHEME}"`, `"scheme": "${values.scheme}"`, 'app.json');
  writeText('app.json', source, dryRun, changedFiles);
}

/**
 * 更新两份 i18n 资源里的应用标题。
 *
 * @param {{displayName: string}} values - 派生值。
 * @param {boolean} dryRun - 是否只演练。
 * @param {string[]} changedFiles - 变更文件收集器。
 * @returns {void}
 */
function updateLocales(values, dryRun, changedFiles) {
  for (const locale of ['zh-CN', 'en-US']) {
    const relativePath = `src/domain/i18n/locales/${locale}.json`;
    const source = readText(relativePath);
    const updated = replaceRequired(
      source,
      `"title": "${PLACEHOLDER_DISPLAY_NAME}"`,
      `"title": "${values.displayName}"`,
      relativePath,
    );
    writeText(relativePath, updated, dryRun, changedFiles);
  }
}

/**
 * 生成正式项目的绑定记录。
 *
 * @param {{projectId: string, displayName: string, scheme: string}} values - 派生值。
 * @returns {string} 绑定文档。
 */
function buildProjectBinding(values) {
  return `# RN Project

## Always-on

- 当前项目是基于 Expo RN 骨架初始化的正式应用。
- 项目 ID 为 \`${values.projectId}\`，Expo 名称为 \`${values.displayName}\`。
- URL scheme 为 \`${values.scheme}\`，与 \`app.json\` 保持一致。
- 运行时环境变量只允许 \`EXPO_PUBLIC_*\` 前缀。
- 分层契约以 \`docs/rules/rn/architecture.md\` 与 \`src/test/architecture/layer-boundary.test.ts\` 为准。

## Routing

- 新增或调整 screen 前，读取 \`docs/rules/rn/frontend.md\` 与 \`docs/rules/rn/naming.md\`。
- 修改网络层前，读取 \`docs/rules/rn/api.md\`。
- 修改存储、鉴权或密钥前，读取 \`docs/rules/rn/storage.md\` 与 \`docs/rules/rn/security.md\`。
- 修改主题、UI 组件前，读取 \`docs/rules/rn/ui-components.md\` 与 \`docs/rules/rn/theme.md\`。
`;
}

/**
 * 更新 AGENTS 的骨架状态并移除一次性初始化路由。
 *
 * @param {string} source - 骨架 AGENTS。
 * @param {Record<string, string>} values - 派生值。
 * @returns {string} 正式项目 AGENTS。
 */
function updateAgents(source, values) {
  const skeletonState = `## 骨架状态

- 本仓库是可复制的 Expo RN 项目骨架，不是正式业务应用。
- 新应用复制后，必须先完成项目身份初始化，不得直接开始业务开发。`;
  const projectState = `## 项目状态

- 当前项目是基于 Expo RN 骨架初始化的正式应用，项目 ID 为 \`${values.projectId}\`。
- 项目绑定见 \`.agents/rn-project.md\`。`;
  let updated = replaceRequired(source, skeletonState, projectState, 'AGENTS.md');

  updated = replaceRequired(
    updated,
    `- 初始化项目身份：\`.agents/skills/initialize-rn-project/SKILL.md\`。\n`,
    '',
    'AGENTS.md',
  );

  return updated;
}

/**
 * 更新 README 的标题与占位说明。
 *
 * @param {string} source - 骨架 README。
 * @param {{projectId: string, displayName: string}} values - 派生值。
 * @returns {string} 正式项目 README。
 */
function updateReadme(source, values) {
  let updated = replaceRequired(source, '# RN Application Skeleton', `# ${values.displayName}`, 'README.md');
  updated = replaceRequired(
    updated,
    '基于 Expo + expo-router 的 React Native 骨架。',
    `基于 Expo + expo-router 的 React Native 应用，项目 ID 为 \`${values.projectId}\`。`,
    'README.md',
  );

  return updated;
}

/**
 * 初始化项目。
 *
 * @returns {void}
 */
function initializeProject() {
  const { dryRun, projectId } = parseArguments();
  const values = {
    projectId,
    displayName: toDisplayName(projectId),
    scheme: projectId.replaceAll('-', ''),
  };

  assertPristineSkeleton();

  const changedFiles = [];
  updatePackageJson(values, dryRun, changedFiles);
  updateAppConfig(values, dryRun, changedFiles);
  updateLocales(values, dryRun, changedFiles);
  writeText('.agents/rn-project.md', buildProjectBinding(values), dryRun, changedFiles);
  writeText('AGENTS.md', updateAgents(readText('AGENTS.md'), values), dryRun, changedFiles);
  writeText('README.md', updateReadme(readText('README.md'), values), dryRun, changedFiles);

  const prefix = dryRun ? '[dry-run] 将变更' : '已初始化';
  process.stdout.write(`${prefix}：${values.projectId}\n`);
  process.stdout.write(`Expo 名称：${values.displayName}\n`);
  process.stdout.write(`URL scheme：${values.scheme}\n`);
  for (const file of changedFiles) {
    process.stdout.write(`- ${file}\n`);
  }
}

try {
  initializeProject();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
