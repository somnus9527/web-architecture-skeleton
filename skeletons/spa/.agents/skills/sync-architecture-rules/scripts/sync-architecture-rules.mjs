import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const ROOT_DIRECTORY = resolve(SCRIPT_DIRECTORY, '../../../..');
const SOURCE_CONFIG_PATH = '.agents/architecture-source.json';
const RULES_LOCK_PATH = '.agents/architecture-rules-lock.json';
const RULES_ROOT = 'docs/rules/';
const EXCLUDED_RULE_PATHS = new Set(['docs/rules/shared/project-naming.md']);

/**
 * 解析同步模式。直接运行脚本时默认只检查，只有显式 --apply 才会写文件。
 *
 * @returns {{ mode: 'check' | 'apply' }} 同步模式。
 */
function parseArguments() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length === 0 || (argumentsList.length === 1 && argumentsList[0] === '--check')) {
    return { mode: 'check' };
  }
  if (argumentsList.length === 1 && argumentsList[0] === '--apply') {
    return { mode: 'apply' };
  }

  throw new Error('用法: node sync-architecture-rules.mjs [--check|--apply]');
}

/**
 * 读取项目根目录下的 JSON 文件。
 *
 * @param {string} relativePath - 项目相对路径。
 * @returns {unknown} 解析后的 JSON。
 */
function readJsonFile(relativePath) {
  try {
    return JSON.parse(readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 ${relativePath}: ${detail}`);
  }
}

/**
 * 校验架构规范来源配置，防止通过异常分支名改变 Git 参数语义。
 *
 * @param {unknown} value - 待校验配置。
 * @returns {{ schemaVersion: number, architecture: string, repository: string, branch: string }} 来源配置。
 */
function validateSourceConfig(value) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${SOURCE_CONFIG_PATH} 必须是 JSON 对象。`);
  }

  const { schemaVersion, architecture, repository, branch } = value;
  if (schemaVersion !== 1) {
    throw new Error(`${SOURCE_CONFIG_PATH} 使用了不支持的 schemaVersion。`);
  }
  if (typeof architecture !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(architecture)) {
    throw new Error(`${SOURCE_CONFIG_PATH} 的 architecture 必须是小写 kebab-case。`);
  }
  if (typeof repository !== 'string' || repository.trim() === '' || repository.startsWith('-')) {
    throw new Error(`${SOURCE_CONFIG_PATH} 缺少 repository。`);
  }
  if (
    typeof branch !== 'string' ||
    branch.startsWith('-') ||
    branch.includes('..') ||
    branch.includes('@{') ||
    !/^[A-Za-z0-9._/-]+$/u.test(branch)
  ) {
    throw new Error(`${SOURCE_CONFIG_PATH} 的 branch 不是安全的 Git 分支名。`);
  }

  return { schemaVersion, architecture, repository, branch };
}

/**
 * 判断路径是否属于允许由上游管理的 Markdown 规范区。
 *
 * @param {string} relativePath - 项目相对路径。
 * @returns {boolean} 是否允许同步。
 */
function isManagedRulePath(relativePath) {
  if (!relativePath.startsWith(RULES_ROOT) || !relativePath.endsWith('.md') || EXCLUDED_RULE_PATHS.has(relativePath)) {
    return false;
  }

  const pathSegments = relativePath.split('/');
  return (
    pathSegments.every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
    /^[a-zA-Z0-9./-]+$/u.test(relativePath)
  );
}

/**
 * 校验上次同步锁文件，确保基线只包含允许管理的规范路径。
 *
 * @param {unknown} value - 待校验锁文件。
 * @param {{ architecture: string }} sourceConfig - 已校验的来源配置。
 * @returns {{ schemaVersion: number, architecture: string, sourceCommit: string, syncedAt: string, files: Record<string, string> }} 同步锁。
 */
function validateRulesLock(value, sourceConfig) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${RULES_LOCK_PATH} 必须是 JSON 对象。`);
  }

  const { schemaVersion, architecture, sourceCommit, syncedAt, files } = value;
  if (schemaVersion !== 1 || architecture !== sourceConfig.architecture) {
    throw new Error(`${RULES_LOCK_PATH} 与当前架构来源不匹配。`);
  }
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40,64}$/u.test(sourceCommit)) {
    throw new Error(`${RULES_LOCK_PATH} 的 sourceCommit 无效。`);
  }
  if (typeof syncedAt !== 'string' || syncedAt.trim() === '') {
    throw new Error(`${RULES_LOCK_PATH} 缺少 syncedAt。`);
  }
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error(`${RULES_LOCK_PATH} 缺少 files 基线。`);
  }

  for (const [relativePath, contentHash] of Object.entries(files)) {
    if (!isManagedRulePath(relativePath) || !/^[0-9a-f]{64}$/u.test(contentHash)) {
      throw new Error(`${RULES_LOCK_PATH} 包含无效基线: ${relativePath}`);
    }
  }

  return { schemaVersion, architecture, sourceCommit, syncedAt, files };
}

/**
 * 在当前仓库对象库中执行受控 Git 命令，并收敛错误输出。
 *
 * @param {string[]} argumentsList - 传给 git 的独立参数。
 * @returns {string} Git 标准输出。
 */
function runGit(argumentsList) {
  try {
    return execFileSync('git', argumentsList, {
      cwd: ROOT_DIRECTORY,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    throw new Error(`Git 命令失败: git ${argumentsList[0]}${stderr ? `\n${stderr}` : ''}`);
  }
}

/**
 * 拉取配置指定分支但不创建工作分支、不切换当前分支，并返回 FETCH_HEAD commit。
 *
 * @param {{ repository: string, branch: string }} sourceConfig - 来源配置。
 * @returns {string} 最新上游 commit。
 */
function fetchSourceCommit(sourceConfig) {
  runGit(['fetch', '--quiet', '--no-tags', sourceConfig.repository, sourceConfig.branch]);
  const sourceCommit = runGit(['rev-parse', '--verify', 'FETCH_HEAD']).trim();
  if (!/^[0-9a-f]{40,64}$/u.test(sourceCommit)) {
    throw new Error('无法解析上游分支的 commit。');
  }

  return sourceCommit;
}

/**
 * 列出上游 commit 中允许同步的普通 Markdown 文件，并拒绝符号链接或可执行文件。
 *
 * @param {string} sourceCommit - 上游 commit。
 * @returns {string[]} 已排序的受管规范路径。
 */
function listUpstreamRuleFiles(sourceCommit) {
  const treeOutput = runGit(['ls-tree', '-r', '-z', sourceCommit, '--', 'docs/rules']);
  const managedPaths = [];

  for (const record of treeOutput.split('\0')) {
    if (!record) {
      continue;
    }

    const separatorIndex = record.indexOf('\t');
    if (separatorIndex < 0) {
      throw new Error('无法解析上游规范文件树。');
    }

    const metadata = record.slice(0, separatorIndex).split(' ');
    const relativePath = record.slice(separatorIndex + 1);
    if (!isManagedRulePath(relativePath)) {
      continue;
    }
    if (metadata[0] !== '100644' || metadata[1] !== 'blob') {
      throw new Error(`上游规范不是普通文件，拒绝同步: ${relativePath}`);
    }

    managedPaths.push(relativePath);
  }

  return managedPaths.sort();
}

/**
 * 读取上游 commit 中的单个规范文件。
 *
 * @param {string} sourceCommit - 上游 commit。
 * @param {string} relativePath - 受管规范路径。
 * @returns {string} 上游文件内容。
 */
function readUpstreamFile(sourceCommit, relativePath) {
  const content = runGit(['show', `${sourceCommit}:${relativePath}`]);
  if (content.includes('\0')) {
    throw new Error(`上游规范包含二进制内容，拒绝同步: ${relativePath}`);
  }

  return content;
}

/**
 * 计算规范内容的 SHA-256，作为三方比较基线。
 *
 * @param {string | Buffer} content - 文件内容。
 * @returns {string} 十六进制 SHA-256。
 */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 读取本地规范 hash；缺失返回 null，符号链接或非普通文件直接拒绝。
 *
 * @param {string} relativePath - 受管规范路径。
 * @returns {string | null} 本地文件 hash。
 */
function readLocalFileHash(relativePath) {
  const filePath = join(ROOT_DIRECTORY, relativePath);
  if (!existsSync(filePath)) {
    return null;
  }

  const fileStat = lstatSync(filePath);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new Error(`本地规范不是普通文件，拒绝同步: ${relativePath}`);
  }

  return hashContent(readFileSync(filePath));
}

/**
 * 比较上次基线、本地文件和最新上游内容，生成不修改磁盘的同步计划。
 *
 * @param {{ files: Record<string, string> }} rulesLock - 上次同步锁。
 * @param {string} sourceCommit - 最新上游 commit。
 * @returns {{
 *   actions: Array<{ kind: 'add' | 'update' | 'delete', path: string, content?: string }>,
 *   adopted: string[],
 *   localModified: string[],
 *   conflicts: Array<{ path: string, reason: string }>,
 *   upstreamHashes: Record<string, string>
 * }} 同步计划。
 */
function buildSyncPlan(rulesLock, sourceCommit) {
  const upstreamContents = new Map();
  const upstreamHashes = {};

  for (const relativePath of listUpstreamRuleFiles(sourceCommit)) {
    const content = readUpstreamFile(sourceCommit, relativePath);
    const contentHash = hashContent(content);
    upstreamContents.set(relativePath, { content, contentHash });
    upstreamHashes[relativePath] = contentHash;
  }

  const actions = [];
  const adopted = [];
  const localModified = [];
  const conflicts = [];
  const candidatePaths = [...new Set([...Object.keys(rulesLock.files), ...upstreamContents.keys()])].sort();

  for (const relativePath of candidatePaths) {
    const baselineHash = rulesLock.files[relativePath] ?? null;
    const upstreamFile = upstreamContents.get(relativePath) ?? null;
    const localHash = readLocalFileHash(relativePath);

    if (baselineHash === null && upstreamFile) {
      if (localHash === null) {
        actions.push({ kind: 'add', path: relativePath, content: upstreamFile.content });
      } else if (localHash === upstreamFile.contentHash) {
        adopted.push(relativePath);
      } else {
        conflicts.push({ path: relativePath, reason: '上游新增文件与本地同名文件内容不同' });
      }
      continue;
    }

    if (!upstreamFile) {
      if (localHash === null) {
        adopted.push(relativePath);
      } else if (localHash === baselineHash) {
        actions.push({ kind: 'delete', path: relativePath });
      } else {
        conflicts.push({ path: relativePath, reason: '上游已删除，但本地文件相对基线有修改' });
      }
      continue;
    }

    if (upstreamFile.contentHash === baselineHash) {
      if (localHash !== baselineHash) {
        localModified.push(relativePath);
      }
      continue;
    }

    if (localHash === baselineHash) {
      actions.push({ kind: 'update', path: relativePath, content: upstreamFile.content });
    } else if (localHash === upstreamFile.contentHash) {
      adopted.push(relativePath);
    } else {
      conflicts.push({ path: relativePath, reason: '本地和上游都修改了该规范' });
    }
  }

  return { actions, adopted, localModified, conflicts, upstreamHashes };
}

/**
 * 应用无冲突的文件计划并更新同步锁。写入范围只可能位于 docs/rules。
 *
 * @param {{ architecture: string }} sourceConfig - 来源配置。
 * @param {string} sourceCommit - 最新上游 commit。
 * @param {{
 *   actions: Array<{ kind: 'add' | 'update' | 'delete', path: string, content?: string }>,
 *   conflicts: Array<{ path: string, reason: string }>,
 *   upstreamHashes: Record<string, string>
 * }} syncPlan - 已计算计划。
 * @returns {void}
 */
function applySyncPlan(sourceConfig, sourceCommit, syncPlan) {
  if (syncPlan.conflicts.length > 0) {
    throw new Error('存在规范同步冲突，未修改任何文件。');
  }

  for (const action of syncPlan.actions) {
    const filePath = join(ROOT_DIRECTORY, action.path);
    if (action.kind === 'delete') {
      unlinkSync(filePath);
      continue;
    }

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, action.content);
  }

  const updatedLock = {
    schemaVersion: 1,
    architecture: sourceConfig.architecture,
    sourceCommit,
    syncedAt: new Date().toISOString(),
    files: syncPlan.upstreamHashes,
  };
  writeFileSync(join(ROOT_DIRECTORY, RULES_LOCK_PATH), `${JSON.stringify(updatedLock, null, 2)}\n`);
}

/**
 * 将 commit 缩短为适合终端汇报的形式。
 *
 * @param {string} commit - 完整 commit。
 * @returns {string} 12 位短 commit。
 */
function formatCommit(commit) {
  return commit.slice(0, 12);
}

/**
 * 输出同步计划和冲突详情，避免隐藏本地规范修改。
 *
 * @param {'check' | 'apply'} mode - 当前模式。
 * @param {{ architecture: string, branch: string }} sourceConfig - 来源配置。
 * @param {{ sourceCommit: string }} rulesLock - 旧同步锁。
 * @param {string} sourceCommit - 最新上游 commit。
 * @param {{
 *   actions: Array<{ kind: string, path: string }>,
 *   adopted: string[],
 *   localModified: string[],
 *   conflicts: Array<{ path: string, reason: string }>
 * }} syncPlan - 同步计划。
 * @returns {void}
 */
function writePlanSummary(mode, sourceConfig, rulesLock, sourceCommit, syncPlan) {
  const actionLabels = { add: '新增', update: '更新', delete: '删除' };
  process.stdout.write(
    `${mode === 'apply' ? '架构规范同步完成' : '架构规范检查完成'}\n` +
      `architecture: ${sourceConfig.architecture}\n` +
      `source-branch: ${sourceConfig.branch}\n` +
      `previous-commit: ${formatCommit(rulesLock.sourceCommit)}\n` +
      `latest-commit: ${formatCommit(sourceCommit)}\n` +
      `file-actions: ${syncPlan.actions.length}\n` +
      `adopted: ${syncPlan.adopted.length}\n` +
      `local-modified: ${syncPlan.localModified.length}\n` +
      `conflicts: ${syncPlan.conflicts.length}\n`,
  );

  for (const action of syncPlan.actions) {
    process.stdout.write(`- [${actionLabels[action.kind]}] ${action.path}\n`);
  }
  for (const relativePath of syncPlan.localModified) {
    process.stdout.write(`- [本地修改，上游未变] ${relativePath}\n`);
  }
  for (const conflict of syncPlan.conflicts) {
    process.stdout.write(`- [冲突] ${conflict.path}: ${conflict.reason}\n`);
  }
}

/**
 * 执行架构规范检查或同步。任何冲突都会在文件写入前终止 apply。
 *
 * @returns {void}
 */
function syncArchitectureRules() {
  const { mode } = parseArguments();
  const sourceConfig = validateSourceConfig(readJsonFile(SOURCE_CONFIG_PATH));
  const rulesLock = validateRulesLock(readJsonFile(RULES_LOCK_PATH), sourceConfig);
  const sourceCommit = fetchSourceCommit(sourceConfig);
  const syncPlan = buildSyncPlan(rulesLock, sourceCommit);

  if (syncPlan.conflicts.length > 0) {
    writePlanSummary('check', sourceConfig, rulesLock, sourceCommit, syncPlan);
    process.exitCode = 2;
    return;
  }

  if (mode === 'apply') {
    applySyncPlan(sourceConfig, sourceCommit, syncPlan);
  }

  writePlanSummary(mode, sourceConfig, rulesLock, sourceCommit, syncPlan);
}

try {
  syncArchitectureRules();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`架构规范同步失败: ${detail}\n`);
  process.exitCode = 1;
}
