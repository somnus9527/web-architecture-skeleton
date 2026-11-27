#!/usr/bin/env node
/**
 * 文档链接检查。
 *
 * 规则：仓库内 Markdown 的文件引用只能指向当前仓库内真实存在的文件；不允许 `..` 逃出仓库，
 * 也不允许指向不存在的跨变体/跨仓库文档。外部 http(s) 链接不在此检查范围。
 *
 * 检查范围是仓库根 README/AGENTS、交付物（skeletons）、技能、模板与仓库文档；rules/ 是源，先经
 * materialize 生成交付物后再检查，避免把「物化后才成立的跨层链接」误报。
 *
 * 用法：node tools/check-doc-links.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SCAN_ROOTS = ['skeletons', 'skills', 'templates', 'docs'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);

/**
 * 递归收集 Markdown 文件。
 *
 * @param {string} directory - 绝对目录。
 * @param {string[]} output - 结果数组。
 * @returns {string[]} Markdown 文件绝对路径。
 */
function collectMarkdown(directory, output = []) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return output;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectMarkdown(absolute, output);
    } else if (entry.name.endsWith('.md')) {
      output.push(absolute);
    }
  }

  return output;
}

/**
 * 去掉 fenced code block 与行内代码，避免把示例语法当成链接。
 *
 * @param {string} content - Markdown 原文。
 * @returns {string} 可扫描文本。
 */
function stripCode(content) {
  return content.replace(/```[\s\S]*?```/gu, '').replace(/`[^`\n]*`/gu, '');
}

/**
 * 解析文件中的 Markdown 链接目标。
 *
 * @param {string} content - 已去掉代码块的 Markdown。
 * @returns {string[]} 原始链接目标。
 */
function extractTargets(content) {
  const targets = [];
  const pattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

/**
 * 判断文件是否存在，目录链接允许落到 README.md。
 *
 * @param {string} absolute - 绝对路径。
 * @returns {boolean} 是否存在。
 */
function targetExists(absolute) {
  if (existsSync(absolute)) {
    return true;
  }
  if (!absolute.endsWith('.md') && existsSync(`${absolute}.md`)) {
    return true;
  }
  return existsSync(join(absolute, 'README.md'));
}

const files = [
  join(ROOT, 'README.md'),
  join(ROOT, 'AGENTS.md'),
  ...SCAN_ROOTS.flatMap((root) => collectMarkdown(join(ROOT, root))),
].filter((file) => existsSync(file));

const failures = [];
let checked = 0;

for (const file of files) {
  const relativeFile = relative(ROOT, file).split(sep).join('/');
  const content = stripCode(readFileSync(file, 'utf8'));

  for (const rawTarget of extractTargets(content)) {
    const target = rawTarget.replace(/^<|>$/gu, '');
    if (/^(?:https?:|mailto:|tel:|#)/u.test(target)) {
      continue;
    }

    const [pathPart] = target.split('#');
    if (!pathPart) {
      continue;
    }

    checked += 1;
    const absolute = resolve(dirname(file), decodeURIComponent(pathPart));
    const relativeTarget = relative(ROOT, absolute);

    if (relativeTarget.startsWith('..') || relativeTarget === '..') {
      failures.push(`${relativeFile} -> ${rawTarget}（指向仓库外）`);
      continue;
    }

    if (!targetExists(absolute)) {
      failures.push(`${relativeFile} -> ${rawTarget}（文件不存在）`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`文档链接检查失败（${failures.length} 处 / 共 ${checked} 条本地链接）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`文档链接检查通过：${files.length} 个 Markdown，${checked} 条本地链接。\n`);
}
