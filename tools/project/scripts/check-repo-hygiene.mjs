#!/usr/bin/env node
/**
 * 仓库卫生检查：env 文件、变量白名单、私钥、二进制、体积、包管理器混用与常见密钥。
 *
 * 用法：
 *   node scripts/check-repo-hygiene.mjs --staged     # pre-commit，只看暂存区
 *   node scripts/check-repo-hygiene.mjs --tracked    # CI 主路径，看全部被跟踪文件
 *   node scripts/check-repo-hygiene.mjs --history    # 诊断历史大对象，不阻断
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import process from 'node:process';

const CONFIG_PATH = '.repo-hygiene.json';
const DEFAULT_CONFIG = {
  maxFileBytes: 2 * 1024 * 1024,
  maxAssetBytes: 300 * 1024,
  maxTextBytes: 300 * 1024,
  textSizeAllowList: [],
  envFileAllowList: ['.env.example', '.env.mock'],
  envFileSuffixAllowList: ['.example'],
  envVarAllowPatterns: ['^APP_ENV$', '^VITE_[A-Z0-9_]+$', '^MOCK_[A-Z0-9_]+$', '^DEV_SERVER_PORT$'],
  binaryExtensions: [
    '.ttf',
    '.otf',
    '.woff',
    '.woff2',
    '.eot',
    '.onnx',
    '.pt',
    '.pth',
    '.bin',
    '.model',
    '.zip',
    '.tar',
    '.gz',
    '.tgz',
    '.7z',
    '.rar',
    '.dmg',
    '.exe',
    '.msi',
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.webm',
    '.mp3',
    '.wav',
    '.flac',
    '.psd',
    '.ai',
    '.sketch',
    '.fig',
  ],
  binaryAllowList: [],
  secretPatterns: [
    'AKIA[0-9A-Z]{16}',
    'ghp_[A-Za-z0-9]{36}',
    'sk-[A-Za-z0-9]{20,}',
    '-----BEGIN [A-Z ]*PRIVATE KEY-----',
    '(?:password|secret|token|api[_-]?key)\\s*[:=]\\s*["\'][^"\']{8,}["\']',
  ],
  secretAllowPatterns: [],
  lockFile: 'pnpm-lock.yaml',
  conflictingLockFile: 'package-lock.json',
};

/**
 * 读取配置并与默认值合并。
 *
 * @returns {typeof DEFAULT_CONFIG} 生效配置。
 */
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const config = { ...DEFAULT_CONFIG, ...raw };

  return config;
}

/**
 * 解析命令行模式。
 *
 * @returns {'staged' | 'tracked' | 'history'} 检查模式。
 */
function parseMode() {
  const argument = process.argv[2] ?? '--tracked';
  const mode = argument.replace(/^--/u, '');
  if (!['staged', 'tracked', 'history'].includes(mode)) {
    throw new Error('用法: node scripts/check-repo-hygiene.mjs [--staged|--tracked|--history]');
  }

  return mode;
}

/**
 * 执行 git 命令。
 *
 * @param {string[]} args - git 参数。
 * @returns {string} 标准输出。
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * 取出待检查文件列表。
 *
 * @param {'staged' | 'tracked'} mode - 模式。
 * @returns {string[]} 文件路径。
 */
function listFiles(mode) {
  const args = mode === 'staged' ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'] : ['ls-files', '-z'];
  return git(args).split('\0').filter(Boolean);
}

/**
 * 判断 env 文件是否允许入库。
 *
 * @param {string} file - 文件路径。
 * @param {typeof DEFAULT_CONFIG} config - 配置。
 * @returns {boolean} 是否允许。
 */
function isAllowedEnvFile(file, config) {
  const name = basename(file);
  if (!/^\.env(\..+)?$/u.test(name)) {
    return true;
  }

  return (
    config.envFileAllowList.includes(name) ||
    config.envFileSuffixAllowList.some((suffix) => name.endsWith(suffix)) ||
    config.envFileAllowList.includes(file)
  );
}

/**
 * 检查 env 文件的变量名是否落在白名单内。
 *
 * @param {string} file - 文件路径。
 * @param {typeof DEFAULT_CONFIG} config - 配置。
 * @returns {string[]} 违规变量名。
 */
function findDisallowedEnvKeys(file, config) {
  const text = readFileSync(file, 'utf8');
  const keys = text
    .split('\n')
    .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(line))
    .filter(Boolean)
    .map((match) => match[1]);

  return keys.filter((key) => !config.envVarAllowPatterns.some((pattern) => new RegExp(pattern, 'u').test(key)));
}

/**
 * 扫描文件中的可疑密钥。
 *
 * @param {string} file - 文件路径。
 * @param {typeof DEFAULT_CONFIG} config - 配置。
 * @returns {string[]} 命中的规则。
 */
function findSecrets(file, config) {
  const text = readFileSync(file, 'utf8');
  return config.secretPatterns.filter((pattern) => {
    if (config.secretAllowPatterns.some((allow) => new RegExp(allow, 'iu').test(file))) {
      return false;
    }
    return new RegExp(pattern, 'iu').test(text);
  });
}

/**
 * 检查暂存或已跟踪文件。
 *
 * @returns {string[]} 违规描述。
 */
function checkTracked() {
  const config = loadConfig();
  const files = listFiles(process.argv[2] === '--staged' ? 'staged' : 'tracked');
  const violations = [];

  for (const file of files) {
    if (!isAllowedEnvFile(file, config)) {
      violations.push(`env 文件不得入库: ${file}`);
      continue;
    }

    const stat = statSync(file, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      continue;
    }

    const extension = extname(file).toLowerCase();
    if (['.pem', '.key', '.p12', '.keystore', '.jks'].includes(extension)) {
      violations.push(`私钥或证书不得入库: ${file}`);
    }
    if (config.binaryExtensions.includes(extension) && !config.binaryAllowList.some((dir) => file.startsWith(dir))) {
      violations.push(`二进制文件不得入库: ${file}（${Math.round(stat.size / 1024)}KB）`);
    }

    if (stat.size > config.maxFileBytes && basename(file) !== config.lockFile) {
      violations.push(`文件超过 ${Math.round(config.maxFileBytes / 1024 / 1024)}MB: ${file}`);
    }

    // 文本体积上限：2MB 只防「异常大文件」，日常真正该拦的是几十上百 KB 的巨型源码/文档/夹具。
    // 锁文件是依赖解析产物，体积由依赖数决定，单独豁免。
    const isTextFile = !config.binaryExtensions.includes(extension);
    if (
      isTextFile &&
      basename(file) !== config.lockFile &&
      stat.size > config.maxTextBytes &&
      !config.textSizeAllowList.some((prefix) => file.startsWith(prefix))
    ) {
      violations.push(
        `文本文件超过 ${Math.round(config.maxTextBytes / 1024)}KB: ${file}（${Math.round(stat.size / 1024)}KB）`,
      );
    }
    if (file.startsWith('public/') && /\.(png|jpe?g|webp|gif|svg)$/iu.test(file) && stat.size > config.maxAssetBytes) {
      violations.push(`图片超过 ${Math.round(config.maxAssetBytes / 1024)}KB: ${file}`);
    }

    const isEnvFile = basename(file).startsWith('.env');
    if (isEnvFile) {
      for (const key of findDisallowedEnvKeys(file, config)) {
        violations.push(`env 变量不在白名单内: ${key} (${file})`);
      }
      continue;
    }

    if (stat.size < 1024 * 1024 && /\.(md|txt|json|ts|tsx|js|mjs|yaml|yml|css|html)$/u.test(file)) {
      for (const rule of findSecrets(file, config)) {
        violations.push(`疑似密钥（${rule.slice(0, 24)}…）: ${file}`);
      }
    }
  }

  if (existsSync(config.conflictingLockFile) && existsSync(config.lockFile)) {
    violations.push(`包管理器混用: 同时存在 ${config.lockFile} 与 ${config.conflictingLockFile}`);
  }

  return violations;
}

/**
 * 诊断历史中的大对象。
 *
 * @returns {string[]} 诊断描述。
 */
function checkHistory() {
  const config = loadConfig();
  const objects = git(['rev-list', '--objects', '--all']).split('\n').filter(Boolean);
  const check = execFileSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'], {
    input: objects.join('\n'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return check
    .split('\n')
    .map((line) => line.split(' '))
    .filter((parts) => parts[0] === 'blob' && Number(parts[2]) > config.maxFileBytes && parts[3] !== config.lockFile)
    .map((parts) => `历史大对象 ${(Number(parts[2]) / 1024 / 1024).toFixed(1)}MB: ${parts[3]}`);
}

const mode = parseMode();
const violations = mode === 'history' ? checkHistory() : checkTracked();

if (violations.length === 0) {
  process.stdout.write(`卫生检查通过（${mode}）\n`);
} else {
  process.stderr.write(`卫生检查发现 ${violations.length} 项问题（${mode}）：\n`);
  for (const violation of violations) {
    process.stderr.write(`  - ${violation}\n`);
  }
  process.exitCode = 1;
}
