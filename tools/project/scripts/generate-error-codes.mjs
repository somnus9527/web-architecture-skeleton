#!/usr/bin/env node
/**
 * 错误码目录门禁：生成 `docs/error-codes.md`，并校验源码里的裸 `code` 字面量都已登记。
 *
 * 目录的唯一来源是 `src/shared/errors/codes.ts`：Node 24 可直接 import `.ts`，所以这里不解析正则，
 * 也不会出现「文档和代码各写一份」的漂移。
 *
 * 用法：
 *   node scripts/generate-error-codes.mjs           # 校验模式（CI / quality:check）
 *   node scripts/generate-error-codes.mjs --write    # 重新生成 docs/error-codes.md
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const CATALOG = 'src/shared/errors/codes.ts';
const OUTPUT = 'docs/error-codes.md';

/**
 * 只检查这些位置的 `code:` 字面量，避免把 Zod issue code 之类的框架枚举当成业务码。
 */
const ENFORCED_FILES = [
  /(?:^|\/)src\/shared\/tools\/api-client\.ts$/u,
  /(?:^|\/)src\/bff\/shared\/http-client\.ts$/u,
  /(?:^|\/)src\/bff\/shared\/http-response\.ts$/u,
  /(?:^|\/)src\/bff\/(?:routes|gateway|transform)\/[^/]+\.ts$/u,
];

/**
 * 日志字段里出现的 `code` 值，不是错误码（例如二进制响应的类型标记）。
 */
const LOG_FIELD_CODES = new Set(['binary']);

/**
 * 递归列出源码文件。
 *
 * @param root - 目录。
 * @returns 文件路径列表。
 */
function listSources(root) {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const child = join(root, entry.name);

    return entry.isDirectory() ? listSources(child) : /\.tsx?$/u.test(entry.name) ? [child] : [];
  });
}

/**
 * 把目录渲染成 Markdown 表。
 *
 * @param codes - `ERROR_CODES` 对象。
 * @param successCode - 成功码。
 * @returns Markdown 文本。
 */
function render(codes, successCode) {
  const rows = Object.values(codes)
    .map((meta) => ({ ...meta }))
    .sort((left, right) => left.code.localeCompare(right.code));
  const lines = [
    '# 错误码目录',
    '',
    '> 本文件由 `pnpm error-codes:table` 生成，请勿手改。新增或修改错误码先改 `src/shared/errors/codes.ts`，',
    '> 再重新生成；`pnpm check:error-codes` 会校验它与代码一致。',
    '',
    `成功码：\`${successCode}\`（\`SUCCESS_CODE\`）。`,
    '',
    '| 常量 | code | HTTP | 归属 | 文案 key | 场景 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const meta of rows) {
    lines.push(
      `| \`${meta.code.replace(/[^a-z0-9]/giu, '_').toUpperCase()}\` | \`${meta.code}\` | ${meta.httpStatus ?? '—'} | ${meta.owner} | ${meta.messageKey ? `\`${meta.messageKey}\`` : '—'} | ${meta.summary} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

const catalogPath = join(process.cwd(), CATALOG);

if (!existsSync(catalogPath)) {
  process.stderr.write(`错误码目录检查失败：缺少 ${CATALOG}\n`);
  process.exit(1);
}

const { ERROR_CODES, SUCCESS_CODE } = await import(pathToFileURL(catalogPath).href);
const codes = Object.values(ERROR_CODES);
const known = new Set(codes.map((meta) => meta.code));
known.add(SUCCESS_CODE);

const problems = [];
const enforced = listSources(join(process.cwd(), 'src')).filter((file) =>
  ENFORCED_FILES.some((pattern) => pattern.test(file)),
);

for (const file of enforced) {
  const source = readFileSync(file, 'utf8');

  for (const match of source.matchAll(/\bcode:\s*'([^']+)'/gu)) {
    if (LOG_FIELD_CODES.has(match[1])) {
      continue;
    }

    if (!known.has(match[1])) {
      problems.push(`${file}: code '${match[1]}' 未登记到 ${CATALOG}`);
    }
  }
}

const expected = render(ERROR_CODES, SUCCESS_CODE);
const write = process.argv.includes('--write');

if (write) {
  writeFileSync(OUTPUT, expected);
  process.stdout.write(`已生成 ${OUTPUT}\n`);
} else if (!existsSync(OUTPUT)) {
  problems.push(`缺少 ${OUTPUT}；运行 pnpm error-codes:table 生成`);
} else if (readFileSync(OUTPUT, 'utf8') !== expected) {
  problems.push(`${OUTPUT} 已过期；运行 pnpm error-codes:table 后提交`);
}

if (problems.length > 0) {
  process.stderr.write(`错误码目录检查失败（${problems.length} 项）：\n`);
  for (const problem of problems) {
    process.stderr.write(`  - ${problem}\n`);
  }
  process.exit(1);
}

process.stdout.write(`错误码目录检查通过（${codes.length} 个错误码，扫描 ${enforced.length} 个文件）\n`);
