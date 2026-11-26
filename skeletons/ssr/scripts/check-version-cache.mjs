#!/usr/bin/env node
/**
 * 公网版本端点缓存检查：确认版本响应没有被 CDN/代理缓存。
 *
 * 用法：
 *   node scripts/check-version-cache.mjs --url https://app.example.com/version.json \
 *     --expected-release-id prod-20261126-abc1234
 */

import process from 'node:process';

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const expectedIndex = args.indexOf('--expected-release-id');
const url = urlIndex >= 0 ? args[urlIndex + 1] : undefined;
const expectedReleaseId = expectedIndex >= 0 ? args[expectedIndex + 1] : undefined;

if (!url) {
  process.stderr.write('用法: node scripts/check-version-cache.mjs --url <url> [--expected-release-id <id>]\n');
  process.exit(1);
}

const response = await globalThis.fetch(url, {
  cache: 'no-store',
  headers: {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

const cacheControl = response.headers.get('cache-control') ?? '';
const age = Number(response.headers.get('age') ?? '0');
const cdnStatus = response.headers.get('x-cache') ?? response.headers.get('cf-cache-status') ?? '';
const via = response.headers.get('via') ?? '';
const failures = [];

if (!response.ok) {
  failures.push(`HTTP ${response.status}`);
}

let payload;
try {
  payload = await response.json();
} catch {
  failures.push('响应不是合法 JSON');
}

if (payload && typeof payload === 'object' && 'releaseId' in payload && typeof payload.releaseId === 'string') {
  if (expectedReleaseId && payload.releaseId !== expectedReleaseId) {
    failures.push(`releaseId 不匹配：期望 ${expectedReleaseId}，实际 ${payload.releaseId}`);
  }
} else {
  failures.push('响应缺少非空 releaseId');
}

if (!/no-store|no-cache/iu.test(cacheControl)) {
  failures.push(`Cache-Control 未禁止缓存：${cacheControl || '<missing>'}`);
}

if (Number.isFinite(age) && age > 0) {
  failures.push(`响应带有 Age=${age}，可能来自 CDN/代理缓存`);
}

if (/hit/iu.test(cdnStatus)) {
  failures.push(`CDN 命中缓存：${cdnStatus}`);
}

if (failures.length > 0) {
  process.stderr.write(`版本端点缓存检查失败（${url}）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  if (via) {
    process.stderr.write(`  - Via: ${via}\n`);
  }
  process.exit(1);
}

process.stdout.write(`版本端点缓存检查通过：${payload.releaseId}（Cache-Control: ${cacheControl}）\n`);
