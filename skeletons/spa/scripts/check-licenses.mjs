#!/usr/bin/env node
/**
 * 许可证门禁：只检查会进入产物的生产依赖，按策略放行，并生成/校验第三方声明。
 *
 * 关注的不是「依赖树里有没有 GPL」，而是「分发出去的 bundle 里有没有」：
 * - 只读 `pnpm licenses list --prod`，devDependency 不进产物，不参与判定；
 * - `deny` 命中直接失败；`review` 命中必须逐条登记理由、负责人与复核期限；
 * - 未知许可同样失败，避免「没有许可证字段」被当成放行。
 *
 * 用法：
 *   node scripts/check-licenses.mjs                  # 策略 + 声明文件新鲜度
 *   node scripts/check-licenses.mjs --write-notice   # 重新生成 THIRD_PARTY_NOTICES.md
 *   node scripts/check-licenses.mjs --emit dist/THIRD_PARTY_NOTICES.md
 */

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const POLICY_PATH = '.license-policy.json';
const DEFAULT_NOTICE_FILE = 'THIRD_PARTY_NOTICES.md';
const NOTICE_SIZE_LIMIT = 280_000;

/**
 * 读取命令行参数。
 *
 * @returns {{ writeNotice: boolean, emit: string[] }} 输出意图。
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const emit = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--emit' && args[index + 1]) {
      emit.push(args[index + 1]);
      index += 1;
    }
  }

  return { writeNotice: args.includes('--write-notice'), emit };
}

/**
 * 读取许可证策略。
 *
 * @returns {{
 *   allow: string[],
 *   review: string[],
 *   deny: string[],
 *   reviewed: Array<{ package: string, license: string, reason: string, owner: string, expiresAt: string }>,
 *   noticeFile: string,
 * }} 策略。
 */
function readPolicy() {
  if (!existsSync(POLICY_PATH)) {
    throw new Error(`缺少 ${POLICY_PATH}；许可证门禁必须显式声明允许清单。`);
  }

  const parsed = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));

  return {
    allow: parsed.allow ?? [],
    review: parsed.review ?? [],
    deny: parsed.deny ?? [],
    reviewed: parsed.reviewed ?? [],
    noticeFile: parsed.noticeFile ?? DEFAULT_NOTICE_FILE,
  };
}

/**
 * 读取生产依赖的许可证清单。
 *
 * @returns {Record<string, Array<Record<string, unknown>>>} 许可表达式到包列表的映射。
 */
function readLicenses() {
  const output = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return JSON.parse(output);
}

/**
 * 把许可表达式拆成「OR 分支 × AND 组」。
 *
 * @param expression - 例如 `(MPL-2.0 OR Apache-2.0)`。
 * @returns 分支列表，每个分支是必须同时满足的许可 ID 列表。
 */
function splitExpression(expression) {
  return expression
    .replace(/[()]/gu, ' ')
    .split(/\s+OR\s+/iu)
    .map((group) =>
      group
        .split(/\s+AND\s+/iu)
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length > 0);
}

/**
 * 给单个许可 ID 分类。
 *
 * @param id - 许可 ID。
 * @param policy - 策略。
 * @returns {'allow' | 'review' | 'deny' | 'unknown'} 分类。
 */
function classifyLicense(id, policy) {
  if (policy.allow.includes(id)) {
    return 'allow';
  }

  if (policy.deny.includes(id)) {
    return 'deny';
  }

  if (policy.review.includes(id)) {
    return 'review';
  }

  return 'unknown';
}

/**
 * 判断复核登记是否有效。
 *
 * @param entry - 复核登记。
 * @returns 过期或字段缺失时返回问题描述。
 */
function findReviewedProblem(entry) {
  if (!entry.reason || !entry.owner || !entry.expiresAt) {
    return '复核登记必须写 reason / owner / expiresAt';
  }

  const expiry = new Date(`${entry.expiresAt}T23:59:59Z`);

  return expiry.getTime() < Date.now() ? `复核登记已于 ${entry.expiresAt} 过期` : undefined;
}

/**
 * 在包目录里按大小写不敏感匹配许可证文件。
 *
 * 必须列目录再匹配：macOS 文件系统大小写不敏感，直接 `existsSync('LICENSE')` 能读到 `license`，
 * 而 Linux CI 读不到——同一份代码会生成两份声明，门禁在本地通过、在 CI 失败。先按标准名匹配，
 * 匹配不到再收 `LICENSE-MIT`、`license.md`、`CopyrightNotice.txt` 这类变体。
 *
 * @param directory - 包目录。
 * @returns 许可证文件路径；没有时返回 undefined。
 */
function findLicenseFile(directory) {
  let files;

  try {
    files = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return undefined;
  }

  const canonical = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING', 'COPYING.md'];

  for (const target of canonical) {
    const hit = files.find((name) => name.toLowerCase() === target.toLowerCase());

    if (hit) {
      return join(directory, hit);
    }
  }

  const variants = files
    .filter((name) => /^(?:licen[cs]e|copying|copyright)(?:[.\-_][^/]*)?$/iu.test(name))
    .sort((left, right) => left.localeCompare(right));

  return variants.length > 0 ? join(directory, variants[0]) : undefined;
}

/**
 * 读取某个包自带的许可证全文。
 *
 * @param pathsByVersion - pnpm 提供的安装路径列表。
 * @returns 许可证全文；找不到时返回 undefined。
 */
function readLicenseText(pathsByVersion) {
  for (const directory of pathsByVersion ?? []) {
    if (!existsSync(directory)) {
      continue;
    }

    const file = findLicenseFile(directory);

    if (file) {
      return readFileSync(file, 'utf8').trim();
    }
  }

  return undefined;
}

/**
 * 生成第三方声明。
 *
 * @param licenses - 许可表达式到包列表的映射。
 * @returns Markdown 文本。
 */
function buildNotice(licenses) {
  const groups = Object.entries(licenses)
    .map(([expression, packages]) => ({
      expression,
      packages: [...packages].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.expression.localeCompare(b.expression));
  const lines = [
    '# 第三方软件声明',
    '',
    '本文件由 `pnpm licenses:notice` 生成，请勿手改；只覆盖会进入产物的生产依赖（devDependency 不在其列）。',
    '发布构建会把同一份文件复制到产物目录，随站点一起分发。',
    '',
    `- 生成命令：\`pnpm licenses:notice\``,
    `- 策略文件：\`${POLICY_PATH}\``,
    '',
  ];

  for (const { expression, packages } of groups) {
    lines.push(`## ${expression}（${packages.length}）`, '');
    lines.push('| 包 | 版本 | 作者 | 主页 |');
    lines.push('| --- | --- | --- | --- |');

    for (const item of packages) {
      const version = (item.versions ?? []).join(', ');
      const author = String(item.author ?? '').replace(/\|/gu, '\\|');
      const homepage = String(item.homepage ?? '').replace(/\|/gu, '\\|');
      lines.push(`| \`${item.name}\` | ${version} | ${author} | ${homepage} |`);
    }

    const texts = new Map();

    for (const item of packages) {
      const text = readLicenseText(item.paths);

      if (text && !texts.has(createHash('sha256').update(text).digest('hex'))) {
        texts.set(createHash('sha256').update(text).digest('hex'), text);
      }
    }

    for (const text of texts.values()) {
      lines.push('', '<details><summary>许可全文</summary>', '', '```text', text, '```', '', '</details>');
    }

    if (texts.size === 0) {
      lines.push('', `> 未在包内找到 LICENSE 文件，请按包主页核对 ${expression} 的署名要求。`);
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

const policy = readPolicy();
const licenses = readLicenses();
const reviewedByPackage = new Map(policy.reviewed.map((entry) => [entry.package, entry]));
const problems = [];
const reviewRequired = [];

for (const [expression, packages] of Object.entries(licenses)) {
  const branches = splitExpression(expression);

  for (const item of packages) {
    const label = `${item.name}@${(item.versions ?? []).join('+')} (${expression})`;
    const classifications = branches.map((group) => group.map((id) => ({ id, kind: classifyLicense(id, policy) })));
    const hasAllowedBranch = classifications.some((group) => group.every((entry) => entry.kind === 'allow'));

    if (hasAllowedBranch) {
      continue;
    }

    const reviewBranch = classifications.find((group) =>
      group.every((entry) => entry.kind === 'allow' || entry.kind === 'review'),
    );

    if (reviewBranch) {
      const reviewed = reviewedByPackage.get(item.name);
      const reviewedProblem = reviewed ? findReviewedProblem(reviewed) : '未登记';

      if (reviewed && !reviewedProblem) {
        continue;
      }

      reviewRequired.push(
        `${label}：${reviewBranch.map((entry) => entry.id).join(' AND ')} 需要人工复核（${reviewedProblem}）`,
      );
      continue;
    }

    const denied = classifications.flat().filter((entry) => entry.kind === 'deny');
    const unknown = classifications.flat().filter((entry) => entry.kind === 'unknown');

    if (denied.length > 0) {
      problems.push(`${label}：命中禁止许可 ${denied.map((entry) => entry.id).join(', ')}`);
    } else if (unknown.length > 0) {
      problems.push(`${label}：未知许可 ${unknown.map((entry) => entry.id).join(', ')}，请先在 ${POLICY_PATH} 归类`);
    } else {
      problems.push(`${label}：不满足任何允许分支`);
    }
  }
}

problems.push(...reviewRequired);

const notice = buildNotice(licenses);

if (Buffer.byteLength(notice, 'utf8') > NOTICE_SIZE_LIMIT) {
  problems.push(`${policy.noticeFile} 体积超过 ${NOTICE_SIZE_LIMIT} 字节，请检查是否把全文重复展开`);
}

const { writeNotice, emit } = parseArgs();

if (writeNotice) {
  writeFileSync(policy.noticeFile, notice);
  process.stdout.write(`已生成 ${policy.noticeFile}\n`);
}

for (const target of emit) {
  writeFileSync(target, notice);
  process.stdout.write(`已写入 ${target}\n`);
}

if (writeNotice || emit.length > 0) {
  if (problems.length > 0) {
    process.stderr.write(`许可证检查发现 ${problems.length} 项问题：\n`);
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`);
    }
    process.exitCode = 1;
  }
} else {
  if (!existsSync(policy.noticeFile)) {
    problems.push(`缺少 ${policy.noticeFile}；先运行 pnpm licenses:notice 生成并提交`);
  } else if (readFileSync(policy.noticeFile, 'utf8') !== notice) {
    problems.push(`${policy.noticeFile} 已过期；运行 pnpm licenses:notice 后提交`);
  }

  if (problems.length === 0) {
    const packageCount = Object.values(licenses).reduce((total, packages) => total + packages.length, 0);
    process.stdout.write(`许可证检查通过（${packageCount} 个生产依赖，${policy.noticeFile} 为最新）\n`);
  } else {
    process.stderr.write(`许可证检查发现 ${problems.length} 项问题：\n`);
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`);
    }
    process.exitCode = 1;
  }
}
