#!/usr/bin/env node
/**
 * 共享能力复用检查：命中重复实现时失败，并给出可直接粘贴的替代 import。
 *
 * 规则（无合法出口不启用，每条命中必须指向一个已存在的能力）：
 * - R1 手写请求三态 → useRequest（读取）/ useAsyncAction（写入）
 * - R2 手写去抖 → useDebouncedValue
 * - R3 直连浏览器存储或 media query → store / 共享 hook
 * - R4 feature 新建通用名组件 → @/shared/ui
 * - R5 深引 shared 内部文件 → barrel
 * - R6 feature 直接发请求 → @/shared/tools/api-client + feature service
 * - L2 函数体结构高度相似 → 复用或上升为共享能力
 *
 * 例外写在 .agents/architecture-exceptions.json（可带 rule），baseline 由 --baseline 生成；
 * 两者有效期都不超过 90 天，过期即失败。
 *
 * 用法：
 *   node scripts/check-reuse.mjs --staged
 *   node scripts/check-reuse.mjs --tracked
 *   node scripts/check-reuse.mjs --files src/features/a.tsx
 *   node scripts/check-reuse.mjs --list
 *   node scripts/check-reuse.mjs --baseline
 *   node scripts/check-reuse.mjs --files a.tsx --root /tmp/demo
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';

const SOURCE_PATTERN = /\.(?:ts|tsx)$/u;
const BUSINESS_PATTERN = /^src\/(?:features|app|router)\//u;
const FEATURE_PATTERN = /^src\/features\//u;
const SHARED_HOOK_PATTERN = /^src\/shared\/hooks\//u;
const SIMILARITY_PATTERN = /^src\/(?:features|shared)\//u;
const IGNORED_PATTERN = /(?:^|\/)(?:src\/test|__tests__|__mocks__|mocks?)(?:\/|$)|\.(?:test|spec)\./u;

const EXCEPTIONS_PATH = '.agents/architecture-exceptions.json';
const BASELINE_PATH = '.agents/reuse-baseline.json';
const MAX_VALID_DAYS = 90;
const SIMILARITY_THRESHOLD = 0.82;
const SIMILARITY_MIN_TOKENS = 120;
const SHINGLE_SIZE = 5;
const MAX_SIMILARITY_REPORTS = 10;

/**
 * feature 里不许自建的通用名文件名（必须有对应的 @/shared/ui 出口）。
 *
 * R4 只收已存在出口的名字；Dialog / Table / TextArea 等随 facade 落地后再扩充，
 * 避免出现“禁了但只能违规”的死角。
 */
const GENERIC_COMPONENT_NAMES = new Set([
  'button',
  'input',
  'select',
  'async-state',
  'empty-state',
  'page-header',
  'stat-card',
  'field-row',
  'status-pill',
]);

const violations = [];
const suppression = {
  exceptions: [],
  baseline: null,
};

/**
 * 记录一条违规；被例外或 baseline 覆盖时跳过。
 *
 * @param {string} file - 相对仓库根目录的路径。
 * @param {number} line - 行号。
 * @param {string} rule - 规则号。
 * @param {string} message - 失败说明与替代方案。
 * @param {string} hash - 片段指纹。
 * @returns {void}
 */
function fail(file, line, rule, message, hash) {
  if (isSuppressed(file, rule, hash)) {
    return;
  }

  violations.push({ file, line, rule, message, hash });
}

/**
 * 判断违规是否被例外或 baseline 覆盖。
 *
 * @param {string} file - 相对路径。
 * @param {string} rule - 规则号。
 * @param {string} hash - 片段指纹。
 * @returns {boolean} 是否放行。
 */
function isSuppressed(file, rule, hash) {
  const excepted = suppression.exceptions.some((entry) => entry.path === file && (!entry.rule || entry.rule === rule));
  if (excepted) {
    return true;
  }

  const baseline = suppression.baseline;
  if (!baseline) {
    return false;
  }

  return baseline.items.some((item) => item.rule === rule && item.path === file && item.hash === hash);
}

/**
 * 计算字符下标所在行号。
 *
 * @param {string} source - 文件内容。
 * @param {number} index - 字符下标。
 * @returns {number} 1 起的行号。
 */
function lineOf(source, index) {
  return source.slice(0, Math.max(index, 0)).split('\n').length;
}

/**
 * 生成片段指纹。
 *
 * @param {string} text - 归一化后的文本。
 * @returns {string} 16 位 sha1。
 */
function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/**
 * 日期字符串（UTC，YYYY-MM-DD）。
 *
 * @param {Date} date - 日期。
 * @returns {string} 日期字符串。
 */
function dateString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * 日期加天数。
 *
 * @param {Date} date - 起始日期。
 * @param {number} days - 天数。
 * @returns {Date} 新日期。
 */
function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * 把注释和字符串替换成空格，保留换行与下标。
 *
 * @param {string} source - 文件内容。
 * @returns {string} 等长掩码文本。
 */
function maskSource(source) {
  const parts = [];
  let state = 'code';
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        parts.push('  ');
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block';
        parts.push('  ');
        index += 2;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') {
        state = char;
        parts.push(' ');
        index += 1;
        continue;
      }
      parts.push(char);
      index += 1;
      continue;
    }

    if (state === 'line') {
      state = char === '\n' ? 'code' : state;
      parts.push(char === '\n' ? '\n' : ' ');
      index += 1;
      continue;
    }

    if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        parts.push('  ');
        index += 2;
        continue;
      }
      parts.push(char === '\n' ? '\n' : ' ');
      index += 1;
      continue;
    }

    if (char === '\\') {
      parts.push('  ');
      index += 2;
      continue;
    }
    if (char === state) {
      state = 'code';
      parts.push(' ');
      index += 1;
      continue;
    }
    parts.push(char === '\n' ? '\n' : ' ');
    index += 1;
  }

  return parts.join('');
}

/**
 * 找到配对的花括号。
 *
 * @param {string} masked - 掩码文本。
 * @param {number} openIndex - 左花括号下标。
 * @returns {number} 右花括号下标，找不到返回 -1。
 */
function matchBrace(masked, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/**
 * 把代码切成 token。
 *
 * @param {string} text - 掩码后的代码。
 * @returns {string[]} token 列表。
 */
function tokenize(text) {
  return text.match(/[A-Za-z_$][\w$]*|\d+|[^\s]/gu) ?? [];
}

/**
 * 计算 token 的 shingle 集合。
 *
 * @param {string[]} tokens - token 列表。
 * @returns {Set<string>} shingle 集合。
 */
function shinglesOf(tokens) {
  const result = new Set();
  for (let index = 0; index + SHINGLE_SIZE <= tokens.length; index += 1) {
    result.add(tokens.slice(index, index + SHINGLE_SIZE).join(' '));
  }
  return result;
}

/**
 * 提取文件里的函数体。
 *
 * @param {string} file - 相对路径。
 * @param {string} source - 文件内容。
 * @returns {Array<{ file: string; name: string; line: number; tokens: string[]; shingles: Set<string> }>} 函数列表。
 */
function extractFunctions(file, source) {
  const masked = maskSource(source);
  const patterns = [
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gu,
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/gu,
  ];
  const functions = [];

  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      const openIndex = masked.indexOf('{', match.index);
      if (openIndex < 0) {
        continue;
      }
      const closeIndex = matchBrace(masked, openIndex);
      if (closeIndex < 0) {
        continue;
      }

      const tokens = tokenize(masked.slice(openIndex + 1, closeIndex));
      if (tokens.length < SIMILARITY_MIN_TOKENS) {
        continue;
      }

      functions.push({
        file,
        name: match[1],
        line: lineOf(source, match.index),
        tokens,
        shingles: shinglesOf(tokens),
      });
    }
  }

  return functions;
}

/**
 * 计算两个 shingle 集合的 Jaccard 相似度。
 *
 * @param {Set<string>} left - 左集合。
 * @param {Set<string>} right - 右集合。
 * @returns {number} 0–1 相似度。
 */
function similarity(left, right) {
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 判断文件是否纳入静态规则检查。
 *
 * @param {string} file - 相对路径。
 * @returns {boolean} 是否检查。
 */
function isCheckedSource(file) {
  return SOURCE_PATTERN.test(file) && BUSINESS_PATTERN.test(file) && !IGNORED_PATTERN.test(file);
}

/**
 * 判断文件是否纳入相似度检查。
 *
 * @param {string} file - 相对路径。
 * @returns {boolean} 是否检查。
 */
function isSimilaritySource(file) {
  return SOURCE_PATTERN.test(file) && SIMILARITY_PATTERN.test(file) && !IGNORED_PATTERN.test(file);
}

/**
 * 读取并校验例外清单。
 *
 * @param {string} root - 项目根目录。
 * @param {Date} today - 今天。
 * @returns {Array<{ path: string; rule?: string; reason: string; expiresAt: string }>} 生效例外。
 */
function loadExceptions(root, today) {
  const path = join(root, EXCEPTIONS_PATH);
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const entries = Array.isArray(parsed) ? parsed : (parsed.exceptions ?? []);
  const active = [];
  const todayText = dateString(today);
  const limitText = dateString(addDays(today, MAX_VALID_DAYS));

  for (const entry of entries) {
    if (!entry?.path || !entry?.expiresAt) {
      violations.push({
        file: EXCEPTIONS_PATH,
        line: 1,
        rule: 'EXC',
        message: '例外条目必须包含 path 与 expiresAt',
        hash: '',
      });
      continue;
    }

    if (entry.expiresAt < todayText) {
      violations.push({
        file: EXCEPTIONS_PATH,
        line: 1,
        rule: 'EXC',
        message: `例外已过期（${entry.expiresAt}）：${entry.path}，请处理或重新评审`,
        hash: '',
      });
      continue;
    }

    if (entry.expiresAt > limitText) {
      violations.push({
        file: EXCEPTIONS_PATH,
        line: 1,
        rule: 'EXC',
        message: `例外有效期超过 ${MAX_VALID_DAYS} 天（${entry.expiresAt}）：${entry.path}`,
        hash: '',
      });
      continue;
    }

    if (typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
      violations.push({
        file: EXCEPTIONS_PATH,
        line: 1,
        rule: 'EXC',
        message: `例外缺少 reason：${entry.path}`,
        hash: '',
      });
      continue;
    }

    active.push(entry);
  }

  return active;
}

/**
 * 读取 baseline。
 *
 * @param {string} root - 项目根目录。
 * @param {Date} today - 今天。
 * @returns {Array<{ rule: string; path: string; hash: string }>} baseline 条目。
 */
function loadBaseline(root, today) {
  const path = join(root, BASELINE_PATH);
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed.expiresAt || parsed.expiresAt < dateString(today)) {
    violations.push({
      file: BASELINE_PATH,
      line: 1,
      rule: 'EXC',
      message: `baseline 已过期（${parsed.expiresAt ?? '缺失'}），请重新评审并生成`,
      hash: '',
    });
    return [];
  }

  return Array.isArray(parsed.items) ? parsed.items : [];
}

/**
 * 读取注册表。
 *
 * @param {string} root - 项目根目录。
 * @returns {Array<Record<string, string>>} 注册项。
 */
function readRegistry(root) {
  const path = join(root, 'docs', 'capabilities.json');
  if (!existsSync(path)) {
    throw new Error('缺少 docs/capabilities.json；请确认已运行物化或初始化技能');
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('docs/capabilities.json 必须是数组');
  }

  return parsed;
}

/**
 * 按模式取文件列表。
 *
 * @param {string} mode - staged / tracked / files。
 * @param {string} root - 项目根目录。
 * @returns {string[]} 相对路径列表。
 */
function listFiles(mode, root) {
  if (mode === 'files') {
    const index = process.argv.indexOf('--files');
    return process.argv
      .slice(index + 1)
      .filter((file) => !file.startsWith('--'))
      .map((file) => file.replace(/^\.\//u, '').replaceAll('\\', '/'));
  }

  const args = mode === 'staged' ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR'] : ['ls-files'];
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => file.replaceAll('\\', '/'));
}

/**
 * 检查单个文件的静态规则。
 *
 * @param {string} root - 项目根目录。
 * @param {string} file - 相对路径。
 * @returns {void}
 */
function checkFile(root, file) {
  if (!isCheckedSource(file)) {
    return;
  }

  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    return;
  }

  const source = readFileSync(absolute, 'utf8');
  const isFeature = FEATURE_PATTERN.test(file);

  const requestState = source.search(/set(?:Loading|IsLoading|LoadState|Pending)\s*\(/u);
  const asyncBoundary = /(?:await\s|\.then\s*\(|\bfetch\s*\(|\bService\.)/u.test(source);
  const usesSharedRequest = /useRequest\s*\(|useAsyncAction\s*\(/u.test(source);
  if (isFeature && /useEffect\s*\(/u.test(source) && requestState >= 0 && asyncBoundary && !usesSharedRequest) {
    fail(
      file,
      lineOf(source, requestState),
      'R1',
      '手写请求三态，请改用 @/shared/hooks 的 useRequest（读取）或 useAsyncAction（写入）',
      hashText(source.slice(requestState, requestState + 120)),
    );
  }

  const timer = source.search(/setTimeout\s*\(/u);
  const debounceShape =
    /setTimeout\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{?[\s\S]{0,240}?\bset[A-Z][\w$]*\s*\(/u;
  if (isFeature && !SHARED_HOOK_PATTERN.test(file) && /clearTimeout\s*\(/u.test(source) && debounceShape.test(source)) {
    fail(
      file,
      lineOf(source, timer),
      'R2',
      '手写去抖，请改用 @/shared/hooks 的 useDebouncedValue',
      hashText(source.slice(timer, timer + 120)),
    );
  }

  const browserApi = source.search(/\b(?:localStorage|sessionStorage|matchMedia)\b/u);
  if (isFeature && browserApi >= 0) {
    fail(
      file,
      lineOf(source, browserApi),
      'R3',
      '直接访问浏览器存储或 media query，请经 store 或共享 hook',
      hashText(source.slice(browserApi, browserApi + 80)),
    );
  }

  if (isFeature) {
    const name = basename(file).replace(SOURCE_PATTERN, '');
    if (GENERIC_COMPONENT_NAMES.has(name)) {
      fail(file, 1, 'R4', `通用名组件 ${name}.tsx 请放进 src/shared/ui 并登记 catalog`, hashText(name));
    }
  }

  const deepImport = source.search(/from\s+['"]@\/shared\/(?:hooks|ui)\/[^'"]+['"]/u);
  if (deepImport >= 0) {
    fail(
      file,
      lineOf(source, deepImport),
      'R5',
      '深引 shared 内部文件，请改从 @/shared/hooks 或 @/shared/ui 导入',
      hashText(source.slice(deepImport, deepImport + 120)),
    );
  }

  if (isFeature) {
    const rawRequest = source.search(/\bfetch\s*\(|axios\.(?:create|request|get|post|put|patch|delete)\s*\(/u);
    if (rawRequest >= 0) {
      fail(
        file,
        lineOf(source, rawRequest),
        'R6',
        '直接发请求，请走 @/shared/tools/api-client 与 feature service',
        hashText(source.slice(rawRequest, rawRequest + 120)),
      );
    }
  }
}

/**
 * 收集参与相似度比较的文件。
 *
 * @param {string} root - 项目根目录。
 * @param {string[]} files - 当前模式下的文件。
 * @returns {string[]} 参与比较的相对路径。
 */
function similarityFiles(root, files) {
  const registryPaths = new Set(readRegistry(root).map((entry) => entry.path));
  const candidates = files.filter((file) => isSimilaritySource(file) && existsSync(join(root, file)));
  const registryFiles = [...registryPaths].filter((file) => existsSync(join(root, file)));

  return [...new Set([...candidates, ...registryFiles])];
}

/**
 * 运行 L2 结构相似检测。
 *
 * @param {string} root - 项目根目录。
 * @param {string[]} files - 当前模式下的文件。
 * @returns {void}
 */
function checkSimilarity(root, files) {
  const corpus = similarityFiles(root, files);
  if (corpus.length < 2) {
    return;
  }

  const registryFiles = new Set(readRegistry(root).map((entry) => entry.path));
  const functions = corpus.flatMap((file) => extractFunctions(file, readFileSync(join(root, file), 'utf8')));
  const reported = new Set();
  let count = 0;

  for (let left = 0; left < functions.length; left += 1) {
    for (let right = left + 1; right < functions.length; right += 1) {
      const a = functions[left];
      const b = functions[right];
      if (a.file === b.file) {
        continue;
      }
      if (registryFiles.has(a.file) && registryFiles.has(b.file)) {
        continue;
      }

      const ratio = a.tokens.length / b.tokens.length;
      if (ratio < 0.77 || ratio > 1.3) {
        continue;
      }

      const score = similarity(a.shingles, b.shingles);
      if (score < SIMILARITY_THRESHOLD) {
        continue;
      }

      const key = [a.file, a.line, b.file, b.line].sort().join('|');
      if (reported.has(key)) {
        continue;
      }
      reported.add(key);
      count += 1;

      if (count > MAX_SIMILARITY_REPORTS) {
        continue;
      }

      const percent = Math.round(score * 100);
      fail(
        b.file,
        b.line,
        'L2',
        `${b.name} 与 ${a.file}:${a.line} 的 ${a.name} 相似度 ${percent}%，请复用或上升为共享能力`,
        hashText(b.tokens.join(' ')),
      );
    }
  }

  if (count > MAX_SIMILARITY_REPORTS) {
    violations.push({
      file: 'src',
      line: 1,
      rule: 'L2',
      message: `另有 ${count - MAX_SIMILARITY_REPORTS} 对相似函数未列出，请先清理已列出的`,
      hash: '',
    });
  }
}

/**
 * 打印注册表。
 *
 * @param {string} root - 项目根目录。
 * @returns {void}
 */
function printRegistry(root) {
  const entries = readRegistry(root);
  const width = Math.max(...entries.map((entry) => entry.id.length), 2);
  process.stdout.write(`共享能力注册表（${entries.length} 项）：\n`);
  for (const entry of entries) {
    process.stdout.write(`  ${entry.id.padEnd(width)}  ${entry.kind.padEnd(7)}  ${entry.import}\n`);
    process.stdout.write(`  ${' '.repeat(width)}  ${entry.purpose}\n`);
  }
}

/**
 * 打印违规列表。
 *
 * @param {Array<{ file: string; line: number; rule: string; message: string }>} items - 违规项。
 * @returns {void}
 */
function printViolations(items) {
  process.stderr.write(`共享能力复用检查失败（${items.length} 项）：\n`);
  for (const violation of items) {
    process.stderr.write(`  - ${violation.file}:${violation.line} ${violation.rule} ${violation.message}\n`);
  }
}

/**
 * 写入 baseline。
 *
 * @param {string} root - 项目根目录。
 * @param {Date} today - 今天。
 * @returns {void}
 */
function writeBaseline(root, today) {
  const path = join(root, BASELINE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const payload = {
    generatedAt: dateString(today),
    expiresAt: dateString(addDays(today, MAX_VALID_DAYS)),
    items: violations
      .filter((violation) => violation.rule !== 'EXC' && violation.hash.length > 0)
      .map(({ rule, file, hash }) => ({ rule, path: file, hash })),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`baseline 已写入 ${BASELINE_PATH}（${payload.items.length} 条，到期 ${payload.expiresAt}）\n`);
}

/**
 * 入口。
 *
 * @returns {void}
 */
function main() {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? resolve(process.argv[rootIndex + 1]) : process.cwd();
  const mode = process.argv.includes('--list')
    ? 'list'
    : process.argv.includes('--staged')
      ? 'staged'
      : process.argv.includes('--tracked')
        ? 'tracked'
        : 'files';
  const today = new Date();

  if (mode === 'list') {
    printRegistry(root);
    return;
  }

  const baselineMode = process.argv.includes('--baseline');
  suppression.exceptions = loadExceptions(root, today);
  suppression.baseline = baselineMode ? null : { items: loadBaseline(root, today) };

  const files = listFiles(mode, root);
  const relevant = files.filter(isCheckedSource);

  for (const file of relevant) {
    checkFile(root, file);
  }

  if (mode !== 'staged') {
    checkSimilarity(root, files);
  }

  if (baselineMode) {
    const configIssues = violations.filter((violation) => violation.rule === 'EXC');
    if (configIssues.length > 0) {
      printViolations(configIssues);
      process.exitCode = 1;
      return;
    }
    writeBaseline(root, today);
    return;
  }

  if (violations.length > 0) {
    printViolations(violations);
    process.exitCode = 1;
    return;
  }

  if (relevant.length === 0 && files.length === 0) {
    process.stdout.write('共享能力复用检查：未涉及业务源码，跳过\n');
    return;
  }

  process.stdout.write(`共享能力复用检查通过（${relevant.length} 个文件）\n`);
}

main();
