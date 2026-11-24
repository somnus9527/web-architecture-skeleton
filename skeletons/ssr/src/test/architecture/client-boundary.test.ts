// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 客户端与出站边界(静态扫描):
 * 1. `'use client'` 文件不得 import `@/bff` 运行时；例外:`import type`(view model)与 Server Action(`@/bff/actions`)。
 * 2. `BACKEND_API_BASE_URL` / `PRISM_MOCK_BASE_URL` 只允许出现在 `bff/shared/server-config.ts` 与 `bff/gateway/**`。
 */
const srcDir = fileURLToPath(new URL('../..', import.meta.url));

/**
 * 递归收集匹配扩展名的文件绝对路径。
 *
 * @param dir - 起始目录。
 * @param extensions - 允许的扩展名。
 * @returns 文件路径列表。
 */
function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

const sourceFiles = collectFiles(srcDir, ['.ts', '.tsx']).filter((file) => !file.includes('/test/'));

describe('client components do not import bff runtime', () => {
  it("'use client' 文件只允许 import type 或 Server Action", () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes("'use client'")) {
        continue;
      }

      const bffImports = content.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"](@\/bff\/[^'"]+)['"]/g);
      for (const match of bffImports) {
        const isTypeOnly = Boolean(match[1]);
        const target = match[2] ?? '';
        const isServerAction = target.startsWith('@/bff/actions');
        if (!isTypeOnly && !isServerAction) {
          violations.push(`${file}: ${target}`);
        }
      }
    }

    expect(violations, `client 组件非法引用 bff 运行时:\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('outbound base url stays in gateway and config', () => {
  it('后端/mock base URL 只出现在 server-config 与 gateway', () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      if (!/BACKEND_API_BASE_URL|PRISM_MOCK_BASE_URL/.test(content)) {
        continue;
      }

      const isAllowed = file.endsWith('/bff/shared/server-config.ts') || file.includes('/bff/gateway/');
      if (!isAllowed) {
        violations.push(file);
      }
    }

    expect(violations, `base URL 泄漏到非法位置:\n${violations.join('\n')}`).toEqual([]);
  });
});
