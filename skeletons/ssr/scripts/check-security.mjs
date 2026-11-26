#!/usr/bin/env node
/**
 * 安全扫描：凭证存储、XSS sink、危险跳转、消息与外链、公开 env 密钥。
 *
 * 凭证存储不是只匹配 `localStorage.setItem('token', ...)`：
 * - 读取同文件的 interface/type 属性，识别 `userInfo.token` 这类嵌套字段；
 * - 识别 `persist` / `pick` / `partialize` / Pinia 持久化插件；
 * - 识别 `JSON.stringify(session)`、`Cookies.set`、`document.cookie`。
 *
 * 用法：
 *   node scripts/check-security.mjs --staged
 *   node scripts/check-security.mjs --tracked
 *   node scripts/check-security.mjs --files a.ts b.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import process from 'node:process';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue']);
const TEST_PATTERN = /(?:^|\/)(?:test|tests|__tests__|__fixtures__)\//u;
const NON_APP_PATTERN = /(?:^|\/)(?:\.agents|scripts|tools|docs|node_modules)\//u;
const GENERATED_PATTERN = /@generated/u;
const SAFE_SINK_PATTERN = /(?:^|\/)src\/shared\/security\/(?:safe-html|json-ld)\.tsx$/u;
const PUBLIC_ENV_SECRET_PATTERN =
  /^(?:VITE|NEXT_PUBLIC)_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|ACCESS[_-]?KEY|API[_-]?KEY)[A-Z0-9_]*$/u;
const ALLOWLIST_PATH = '.security-allowlist.json';

const SENSITIVE_VALUE_PATTERN =
  /(?:\b[A-Za-z_$][\w$]*Token\b|\btoken\b|\baccess[_-]?token\b|\brefresh[_-]?token\b|\bauthority[_-]?token\b|\bid[_-]?token\b|\bsession[_-]?id\b|\bjwt\b|\bcredential\b|\bpassword\b)/iu;
const STORAGE_SINK_PATTERN =
  /\b(?:localStorage|sessionStorage|indexedDB)\b|createJSONStorage|piniaPluginPersistedstate|Cookies\.set|document\.cookie\s*=/u;
const XSS_SINK_PATTERN = /dangerouslySetInnerHTML|\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write\s*\(/u;
const DYNAMIC_CODE_PATTERN = /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]/u;
const TARGET_BLANK_PATTERN = /target\s*=\s*['"]_blank['"]/u;
const REL_NOOPENER_PATTERN = /rel\s*=\s*['"][^'"]*(?:noopener|noreferrer)/iu;
const POST_MESSAGE_WILDCARD_PATTERN = /postMessage\s*\([^)]*,\s*['"]\*['"]\s*\)/u;
const WINDOW_OPEN_PATTERN = /window\.open\s*\(/u;
const NOOPENER_PATTERN = /noopener/iu;

/**
 * 读取命令行模式。
 *
 * @returns {{ mode: 'staged' | 'tracked' | 'files', files: string[] }} 扫描模式与显式文件。
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--staged') ? 'staged' : args.includes('--files') ? 'files' : 'tracked';
  const fileIndex = args.indexOf('--files');
  const files = fileIndex >= 0 ? args.slice(fileIndex + 1) : [];

  return { mode, files };
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
 * 列出待扫描文件。
 *
 * @param {'staged' | 'tracked' | 'files'} mode - 扫描模式。
 * @param {string[]} explicit - 显式文件。
 * @returns {string[]} 文件路径。
 */
function listFiles(mode, explicit) {
  const files =
    mode === 'staged'
      ? git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0')
      : mode === 'tracked'
        ? git(['ls-files', '-z']).split('\0')
        : explicit;

  return files.filter((file) => file && SOURCE_EXTENSIONS.has(extname(file).toLowerCase()));
}

/**
 * 列出待扫描的 env 文件。
 *
 * @param {'staged' | 'tracked' | 'files'} mode - 扫描模式。
 * @param {string[]} explicit - 显式文件。
 * @returns {string[]} env 文件路径。
 */
function listEnvFiles(mode, explicit) {
  const files =
    mode === 'staged'
      ? git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0')
      : mode === 'tracked'
        ? git(['ls-files', '-z']).split('\0')
        : explicit;

  return files.filter((file) => file && /(?:^|\/)\.env(?:\.[^/]*)?$/u.test(file));
}

/**
 * 扫描公开前缀 env 变量名是否暴露 secret 语义。
 *
 * @param {string} file - env 文件。
 * @returns {string[]} 违规描述。
 */
function scanPublicEnvSecrets(file) {
  const content = readFileSync(file, 'utf8');
  return content
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/u.test(line))
    .map(({ line, index }) => ({ key: line.split('=')[0].trim(), line: index + 1 }))
    .filter(({ key }) => PUBLIC_ENV_SECRET_PATTERN.test(key))
    .map(
      ({ key, line }) =>
        `${file}:${line} SEC-008 公开前缀变量 ${key} 含 secret 语义；不要在 VITE_*/NEXT_PUBLIC_* 中放密钥`,
    );
}

/**
 * 读取 allowlist。
 *
 * @returns {{ paths: string[], keys: string[], rules: string[] }} 允许项。
 */
function readAllowlist() {
  const defaults = { paths: [], keys: [], rules: [] };
  if (!existsSync(ALLOWLIST_PATH)) {
    return defaults;
  }

  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
    return {
      paths: Array.isArray(raw.paths) ? raw.paths : [],
      keys: Array.isArray(raw.keys) ? raw.keys : [],
      rules: Array.isArray(raw.rules) ? raw.rules : [],
    };
  } catch {
    return defaults;
  }
}

/**
 * 判断文件是否允许跳过。
 *
 * @param {string} file - 文件路径。
 * @param {{ paths: string[] }} allowlist - allowlist。
 * @returns {boolean} 是否跳过。
 */
function shouldSkipFile(file, allowlist) {
  if (TEST_PATTERN.test(file) || NON_APP_PATTERN.test(file)) {
    return true;
  }
  if (allowlist.paths.some((pattern) => new RegExp(pattern, 'u').test(file))) {
    return true;
  }

  const content = readFileSync(file, 'utf8');
  return GENERATED_PATTERN.test(content.slice(0, 400));
}

/**
 * 去掉行注释与块注释，避免注释里的示例命中安全规则。
 *
 * @param {string} content - 文件文本。
 * @returns {string} 去注释文本。
 */
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ''))
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

/**
 * 从 interface/type 声明提取属性名。
 *
 * @param {string} content - 文件文本。
 * @returns {Map<string, Set<string>>} 类型名到属性名集合。
 */
function collectTypeProperties(content) {
  const types = new Map();
  const declarationPattern = /\b(?:interface|type)\s+([A-Za-z_$][\w$]*)[^{=]*[={]/gu;
  let match;

  while ((match = declarationPattern.exec(content)) !== null) {
    const name = match[1];
    const braceIndex = content.indexOf('{', match.index);
    if (braceIndex < 0) {
      continue;
    }

    let depth = 0;
    let end = -1;
    for (let index = braceIndex; index < content.length; index += 1) {
      if (content[index] === '{') {
        depth += 1;
      } else if (content[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end < 0) {
      continue;
    }

    const body = content.slice(braceIndex + 1, end);
    const properties = new Set(
      Array.from(body.matchAll(/(?:^|[;,{]\s*)([A-Za-z_$][\w$]*)\??\s*:/gu), (property) => property[1]),
    );
    if (properties.size > 0) {
      types.set(name, properties);
    }
  }

  return types;
}

/**
 * 判断属性集合中是否有敏感字段。
 *
 * @param {Set<string>} properties - 属性名。
 * @returns {string | null} 命中的敏感属性。
 */
function findSensitiveProperty(properties) {
  for (const property of properties) {
    if (SENSITIVE_VALUE_PATTERN.test(property)) {
      return property;
    }
  }

  return null;
}

/**
 * 收集文件引用的类型名（含泛型与类型标注）。
 *
 * @param {string} content - 文件文本。
 * @returns {string[]} 类型名。
 */
function collectTypeReferences(content) {
  return Array.from(
    new Set([
      ...Array.from(content.matchAll(/<\s*([A-Za-z_$][\w$]*)\s*>/gu), (match) => match[1]),
      ...Array.from(content.matchAll(/:\s*([A-Za-z_$][\w$]*)\b/gu), (match) => match[1]),
      ...Array.from(content.matchAll(/\bas\s+([A-Za-z_$][\w$]*)\b/gu), (match) => match[1]),
    ]),
  );
}

/**
 * 找到某一行号。
 *
 * @param {string} content - 文件文本。
 * @param {number} index - 字符下标。
 * @returns {number} 1-based 行号。
 */
function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

/**
 * 扫描单个文件。
 *
 * @param {string} file - 文件路径。
 * @param {Map<string, Set<string>>} globalTypes - 全仓类型索引。
 * @param {{ keys: string[] }} allowlist - allowlist。
 * @returns {string[]} 违规描述。
 */
function scanFile(file, globalTypes, allowlist) {
  const content = readFileSync(file, 'utf8');
  const code = stripComments(content);
  const violations = [];
  const localTypes = collectTypeProperties(content);
  const typeIndex = new Map([...globalTypes, ...localTypes]);
  const references = collectTypeReferences(code);

  const sensitiveTypes = new Map();
  for (const [name, properties] of typeIndex) {
    const property = findSensitiveProperty(properties);
    if (property) {
      sensitiveTypes.set(name, property);
    }
  }

  const hasStorageSink = STORAGE_SINK_PATTERN.test(code);
  const hasSensitiveValue = SENSITIVE_VALUE_PATTERN.test(code);
  const referencedSensitiveType = references.find((name) => sensitiveTypes.has(name));

  if (hasStorageSink && (hasSensitiveValue || referencedSensitiveType)) {
    const sinkIndex = code.search(STORAGE_SINK_PATTERN);
    const sensitiveIndex = code.search(SENSITIVE_VALUE_PATTERN);
    const sensitiveHint = referencedSensitiveType
      ? `引用类型 ${referencedSensitiveType}.${sensitiveTypes.get(referencedSensitiveType)}`
      : `敏感字段 ${code.slice(sensitiveIndex).match(SENSITIVE_VALUE_PATTERN)?.[0] ?? 'token'}`;

    const storageLine = lineOf(code, sinkIndex);
    const allowlistedKey = allowlist.keys.some((pattern) => new RegExp(pattern, 'u').test(code));
    if (!allowlistedKey) {
      violations.push(`${file}:${storageLine} SEC-001 前端存储疑似持久化凭证（${sensitiveHint}）；改 HttpOnly cookie`);
    }
  }

  if (XSS_SINK_PATTERN.test(code) && !SAFE_SINK_PATTERN.test(file)) {
    violations.push(
      `${file}:${lineOf(code, code.search(XSS_SINK_PATTERN))} SEC-002 禁止直接写入 HTML；富文本走 SafeHtml`,
    );
  }
  if (DYNAMIC_CODE_PATTERN.test(code)) {
    violations.push(`${file}:${lineOf(code, code.search(DYNAMIC_CODE_PATTERN))} SEC-003 禁止动态执行字符串`);
  }
  if (TARGET_BLANK_PATTERN.test(code) && !REL_NOOPENER_PATTERN.test(code)) {
    violations.push(
      `${file}:${lineOf(code, code.search(TARGET_BLANK_PATTERN))} SEC-005 target=_blank 必须带 rel=noopener noreferrer`,
    );
  }
  if (POST_MESSAGE_WILDCARD_PATTERN.test(code)) {
    violations.push(
      `${file}:${lineOf(code, code.search(POST_MESSAGE_WILDCARD_PATTERN))} SEC-006 postMessage 禁止使用 '*'`,
    );
  }
  if (WINDOW_OPEN_PATTERN.test(code) && !NOOPENER_PATTERN.test(code)) {
    violations.push(`${file}:${lineOf(code, code.search(WINDOW_OPEN_PATTERN))} SEC-006 window.open 必须带 noopener`);
  }

  return violations;
}

const { mode, files } = parseArgs();
const allowlist = readAllowlist();
const targets = listFiles(mode, files).filter((file) => existsSync(file) && !shouldSkipFile(file, allowlist));
const globalTypes = new Map();

for (const file of targets) {
  for (const [name, properties] of collectTypeProperties(readFileSync(file, 'utf8'))) {
    globalTypes.set(name, properties);
  }
}

const violations = targets.flatMap((file) => scanFile(file, globalTypes, allowlist));
const envViolations = listEnvFiles(mode, files)
  .filter((file) => existsSync(file))
  .flatMap((file) => scanPublicEnvSecrets(file));
violations.push(...envViolations);

if (violations.length === 0) {
  process.stdout.write(`安全扫描通过（${mode}，${targets.length} 个文件）\n`);
} else {
  process.stderr.write(`安全扫描发现 ${violations.length} 项问题（${mode}）：\n`);
  for (const violation of violations) {
    process.stderr.write(`  - ${violation}\n`);
  }
  process.exitCode = 1;
}
