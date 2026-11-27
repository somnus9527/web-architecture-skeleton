#!/usr/bin/env node
/**
 * SRI（Subresource Integrity）门禁：跨源脚本与样式必须带 integrity + crossorigin，且与允许清单一致。
 *
 * 为什么要这条门禁：
 * - 跨源资源一旦被 CDN 劫持/篡改，浏览器只有靠 integrity 才会拒绝执行；
 * - same-origin 资源不强制（同源服务器被攻破时，攻击者能同时改 HTML 与哈希，SRI 没有增益，
 *   而 CDN 改写内容时反而会把站点打白屏）。
 *
 * 用法：
 *   node scripts/check-sri.mjs --html dist
 *   node scripts/check-sri.mjs --source src
 *   node scripts/check-sri.mjs --html dist --source src --allowlist .sri-allowlist.json
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

/** 只认 http(s) 与协议相对路径；其余（data:、blob:）由 CSP 另行约束，不归 SRI 管。 */
const EXTERNAL_URL_PATTERN = /^(?:https?:)?\/\//iu;
const TAG_PATTERN = /<(?:script|Script|link)\b[^>]*>/gu;
const ATTRIBUTE_PATTERN = /([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/gu;
const DEFAULT_ALLOWLIST = '.sri-allowlist.json';

/**
 * 读取命令行参数。
 *
 * @returns {{ html: string[], source: string[], allowlist: string }} 扫描目标与允许清单路径。
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const collect = (flag) => {
    const values = [];
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] === flag) {
        index += 1;
        while (index < args.length && !args[index].startsWith('--')) {
          values.push(args[index]);
          index += 1;
        }
        index -= 1;
      }
    }
    return values;
  };
  const allowlistIndex = args.indexOf('--allowlist');

  return {
    html: collect('--html'),
    source: collect('--source'),
    allowlist: allowlistIndex >= 0 ? args[allowlistIndex + 1] : DEFAULT_ALLOWLIST,
  };
}

/**
 * 递归列出指定目录下的文件。
 *
 * @param root - 目录。
 * @param matcher - 文件扩展名正则。
 * @returns 文件路径列表。
 */
function listFiles(root, matcher) {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const child = join(root, entry.name);

    return entry.isDirectory() ? listFiles(child, matcher) : matcher.test(entry.name) ? [child] : [];
  });
}

/**
 * 解析标签属性；`{...}` 表达式保留原始文本，便于识别「外链写成表达式」的情况。
 *
 * @param tag - 标签原文。
 * @returns 小写属性名到值的映射。
 */
function parseAttributes(tag) {
  const attributes = new Map();

  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    const [, name, doubleQuoted, singleQuoted, expression] = match;
    attributes.set(name.toLowerCase(), doubleQuoted ?? singleQuoted ?? `{${expression ?? ''}}`);
  }

  return attributes;
}

/**
 * 从一段文本里提取跨源脚本与样式引用。
 *
 * @param content - HTML 或源码文本。
 * @returns {{ kind: 'script' | 'stylesheet', url: string, integrity: string | undefined, crossorigin: boolean, expression: boolean }[]}
 */
function collectExternalTags(content) {
  const found = [];

  for (const match of content.matchAll(TAG_PATTERN)) {
    const tag = match[0];
    const attributes = parseAttributes(tag);
    const isScript = /^<script/iu.test(tag);
    const isStylesheet = /^<link/iu.test(tag) && /stylesheet/iu.test(attributes.get('rel') ?? '');
    const rawUrl = isScript ? attributes.get('src') : isStylesheet ? attributes.get('href') : undefined;

    if (!rawUrl) {
      continue;
    }

    const expression = rawUrl.startsWith('{');
    const url = expression
      ? rawUrl
          .slice(1, -1)
          .trim()
          .replace(/^['"`]|['"`]$/gu, '')
      : rawUrl;

    if (!EXTERNAL_URL_PATTERN.test(url)) {
      continue;
    }

    found.push({
      kind: isScript ? 'script' : 'stylesheet',
      url,
      integrity: attributes.get('integrity'),
      crossorigin: attributes.has('crossorigin'),
      expression,
    });
  }

  return found;
}

/**
 * 读取 SRI 允许清单。
 *
 * @param path - 清单路径。
 * @returns {{ allow: Array<Record<string, string>> }} 允许项。
 */
function readAllowlist(path) {
  if (!existsSync(path)) {
    return { allow: [] };
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));

  return { allow: Array.isArray(parsed.allow) ? parsed.allow : [] };
}

/**
 * 判断允许项是否已过期。
 *
 * @param entry - 允许项。
 * @returns 过期说明；未过期返回 undefined。
 */
function findExpiryProblem(entry) {
  const expiresAt = entry.expiresAt;

  if (!expiresAt) {
    return '缺少 expiresAt（外链必须设复核期限）';
  }

  const expiry = new Date(`${expiresAt}T23:59:59Z`);

  if (Number.isNaN(expiry.getTime())) {
    return `expiresAt 不是合法日期：${expiresAt}`;
  }

  return expiry.getTime() < Date.now() ? `已于 ${expiresAt} 过期，请确认是否还需要该外链` : undefined;
}

const { html, source, allowlist: allowlistPath } = parseArgs();
const allowlist = readAllowlist(allowlistPath);
const allowByUrl = new Map(allowlist.allow.map((entry) => [entry.url, entry]));
const scanned = [];
let htmlFileCount = 0;

for (const directory of html) {
  for (const file of listFiles(directory, /\.html?$/u)) {
    htmlFileCount += 1;
    for (const tag of collectExternalTags(readFileSync(file, 'utf8'))) {
      scanned.push({ file, ...tag });
    }
  }
}

for (const directory of source) {
  for (const file of listFiles(directory, /\.(?:tsx?|jsx?|html?)$/u)) {
    for (const tag of collectExternalTags(readFileSync(file, 'utf8'))) {
      scanned.push({ file, ...tag });
    }
  }
}

const problems = [];

if (html.length > 0 && htmlFileCount === 0) {
  problems.push(`未在 ${html.join(', ')} 找到 HTML 产物；先构建再跑 SRI 检查`);
}

for (const entry of allowlist.allow) {
  if (!entry.url || !entry.integrity || !entry.reason || !entry.owner) {
    problems.push(`${allowlistPath}: 允许项缺少 url / integrity / reason / owner 之一：${entry.url ?? '(no url)'}`);
    continue;
  }

  const expiryProblem = findExpiryProblem(entry);

  if (expiryProblem) {
    problems.push(`${allowlistPath}: ${entry.url} ${expiryProblem}`);
  }
}

for (const tag of scanned) {
  const label = `${relative(process.cwd(), tag.file)} <${tag.kind} src="${tag.url}">`;
  const allowed = allowByUrl.get(tag.url);

  if (tag.expression) {
    problems.push(`${label}：外链必须写成字面量 URL，才能固定 integrity 并被本检查识别`);
    continue;
  }

  if (!allowed) {
    problems.push(`${label}：跨源资源未登记到 ${allowlistPath}，请先走「三方 JS 引入流程」`);
    continue;
  }

  if (!tag.integrity) {
    problems.push(`${label}：缺少 integrity 属性，浏览器无法校验资源完整性`);
  } else if (tag.integrity.trim() !== allowed.integrity.trim()) {
    problems.push(`${label}：integrity 与允许清单不一致（清单 ${allowed.integrity}）`);
  }

  if (!tag.crossorigin) {
    problems.push(`${label}：缺少 crossorigin 属性；跨源校验需要 CDN 返回 CORS 头`);
  }
}

const usedUrls = new Set(scanned.map((tag) => tag.url));
const unusedEntries = allowlist.allow.filter((entry) => entry.url && !usedUrls.has(entry.url));

for (const entry of unusedEntries) {
  problems.push(`${allowlistPath}: ${entry.url} 已登记但产物里没有引用，请删除死条目`);
}

if (problems.length === 0) {
  const externalCount = scanned.length;
  process.stdout.write(`SRI 检查通过（跨源资源 ${externalCount} 个，允许清单 ${allowlist.allow.length} 条）\n`);
} else {
  process.stderr.write(`SRI 检查发现 ${problems.length} 项问题：\n`);
  for (const problem of problems) {
    process.stderr.write(`  - ${problem}\n`);
  }
  process.exitCode = 1;
}
