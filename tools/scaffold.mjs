#!/usr/bin/env node
/**
 * 前端骨架脚手架：从仓库（远程 tag 或本地目录）生成一个新项目。
 *
 * 用法：
 *   node tools/scaffold.mjs --type spa --name demo-app --target ../demo-app
 *   node tools/scaffold.mjs --type monorepo --name acme --target ../acme --apps spa:web,ssr:site
 *   node tools/scaffold.mjs --type ssr --name site --source ../web-architecture-skeleton
 *
 * 远程模式默认取最新 tag；--source 走本地目录，供离线与测试使用。
 */

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const DEFAULT_REPO = 'git@github.com:somnus9527/web-architecture-skeleton.git';
const SUPPORTED_TYPES = new Set(['spa', 'ssr', 'rn', 'monorepo']);
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const IGNORED_COPY = new Set(['node_modules', '.next', 'dist', 'coverage', '.git']);

/**
 * 读取命令行参数。
 *
 * @returns {Record<string, string|boolean>} 参数集合。
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--')) {
      throw new Error(`未知参数：${argument}`);
    }

    const key = argument.slice(2);
    if (['dry-run', 'no-install', 'no-git', 'skip-check', 'help'].includes(key)) {
      options[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`--${key} 需要一个值`);
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

/**
 * 执行命令并把输出接到当前进程。
 *
 * @param {string} command - 可执行文件。
 * @param {string[]} args - 参数。
 * @param {string} cwd - 工作目录。
 * @returns {void}
 */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

/**
 * 执行命令并返回标准输出。
 *
 * @param {string} command - 可执行文件。
 * @param {string[]} args - 参数。
 * @returns {string} 输出。
 */
function capture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
}

/**
 * 取仓库最新语义化 tag。
 *
 * @param {string} repository - 仓库地址。
 * @returns {string} tag 名。
 */
function latestTag(repository) {
  const output = capture('git', ['ls-remote', '--tags', '--refs', repository]);
  const tags = output
    .split('\n')
    .map((line) => line.split('refs/tags/')[1])
    .filter((tag) => tag && /^v?\d+\.\d+\.\d+$/u.test(tag));

  if (tags.length === 0) {
    throw new Error(`${repository} 没有任何语义化 tag；请先发版打 tag，或用 --ref 显式指定。`);
  }

  return tags.sort((left, right) => left.localeCompare(right, undefined, { numeric: true })).at(-1);
}

/**
 * 解析并准备模板来源。
 *
 * @param {Record<string, string|boolean>} options - 参数。
 * @returns {{ repoRoot: string; label: string; ref: string; commit: string; cleanup: () => void }} 来源信息。
 */
function resolveSource(options) {
  if (typeof options.source === 'string') {
    const repoRoot = resolve(options.source);
    if (!existsSync(join(repoRoot, 'skeletons')) || !existsSync(join(repoRoot, 'tools', 'init'))) {
      throw new Error(`--source 不是骨架仓库根目录：${repoRoot}`);
    }

    const commit = capture('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).trim();
    return { repoRoot, label: repoRoot, ref: 'working-tree', commit, cleanup: () => undefined };
  }

  const repository = typeof options.repo === 'string' ? options.repo : DEFAULT_REPO;
  const ref = typeof options.ref === 'string' ? options.ref : latestTag(repository);
  const temporary = mkdtempSync(join(tmpdir(), 'web-skeleton-'));
  run('git', ['clone', '--quiet', '--depth', '1', '--branch', ref, repository, temporary], process.cwd());
  const commit = capture('git', ['-C', temporary, 'rev-parse', 'HEAD']).trim();

  return {
    repoRoot: temporary,
    label: repository,
    ref,
    commit,
    cleanup: () => rmSync(temporary, { recursive: true, force: true }),
  };
}

/**
 * 校验目标目录：不存在或为空目录。
 *
 * @param {string} target - 绝对路径。
 * @returns {void}
 */
function assertTargetUsable(target) {
  if (!existsSync(target)) {
    return;
  }
  if (readdirSync(target).length > 0) {
    throw new Error(`目标目录非空：${target}`);
  }
}

/**
 * 复制骨架目录，排除依赖与构建产物。
 *
 * @param {string} source - 骨架目录。
 * @param {string} destination - 目标目录。
 * @returns {void}
 */
function copySkeleton(source, destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    filter: (path) => !IGNORED_COPY.has(path.split('/').at(-1)),
  });
}

/**
 * 生成项目。
 *
 * @param {Record<string, string|boolean>} options - 参数。
 * @returns {void}
 */
function main() {
  const options = parseArguments();
  if (options.help) {
    process.stdout.write(
      '用法：node tools/scaffold.mjs --type <spa|ssr|rn|monorepo> --name <id> [--target <dir>] ' +
        '[--apps spa:web,ssr:site] [--ref <tag>] [--repo <url>] [--source <dir>] ' +
        '[--no-install] [--no-git] [--skip-check] [--dry-run]\n',
    );
    return;
  }

  const type = String(options.type ?? '');
  const name = String(options.name ?? '');
  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error('--type 必须是 spa / ssr / rn / monorepo 之一');
  }
  if (!KEBAB_CASE.test(name)) {
    throw new Error(`--name 必须是 kebab-case：${name}`);
  }

  const target = resolve(typeof options.target === 'string' ? options.target : name);
  assertTargetUsable(target);

  const apps = String(options.apps ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (type === 'monorepo' && apps.length === 0) {
    throw new Error('monorepo 必须用 --apps 指定至少一个应用，例如 spa:web,ssr:site');
  }

  if (options['dry-run']) {
    process.stdout.write(`[dry-run] type=${type} name=${name} target=${target} apps=${apps.join(',') || '-'}\n`);
    return;
  }

  const source = resolveSource(options);
  const staging = `${target}.tmp-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });

  try {
    if (type === 'monorepo') {
      const args = [
        join(source.repoRoot, 'tools', 'init', 'monorepo.mjs'),
        '--id',
        name,
        '--target',
        staging,
        '--no-install',
      ];
      for (const app of apps) {
        args.push('--app', app);
      }
      run(process.execPath, args, source.repoRoot);
    } else {
      copySkeleton(join(source.repoRoot, 'skeletons', type), staging);
      const initArgs = [join(source.repoRoot, 'tools', 'init', `${type}.mjs`), '--root', staging];
      if (type === 'spa' || type === 'ssr') {
        initArgs.push('--no-backend');
      }
      initArgs.push(name);
      run(process.execPath, initArgs, staging);
    }

    writeFileSync(
      join(staging, '.agents', 'architecture-source.json'),
      `${JSON.stringify(
        { schemaVersion: 2, variant: type, repository: source.label, ref: source.ref, commit: source.commit },
        null,
        2,
      )}\n`,
    );

    if (!options['no-git']) {
      run('git', ['init', '--quiet'], staging);
    }

    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
    renameSync(staging, target);

    writeFileSync(
      join(target, '.agents', 'init-report.json'),
      `${JSON.stringify(
        {
          type,
          name,
          apps,
          repository: source.label,
          ref: source.ref,
          commit: source.commit,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );

    if (!options['no-install']) {
      run('pnpm', ['install'], target);
    }

    if (!options['skip-check'] && !options['no-install']) {
      const checkScript = type === 'monorepo' ? 'check' : 'quality:check';
      try {
        run('pnpm', [checkScript], target);
      } catch {
        process.stderr.write('初始化完成，但 quality:check 未通过；请按上面的输出修复后重跑。\n');
        process.exitCode = 2;
        return;
      }
    }

    process.stdout.write(`项目已生成：${target}（${type}，来源 ${source.ref}@${source.commit.slice(0, 7)}）\n`);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  } finally {
    source.cleanup();
  }
}

main();
