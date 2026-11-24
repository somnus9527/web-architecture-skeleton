import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const HOOKS_ROOT = join(process.cwd(), 'src', 'shared', 'hooks');
const CATALOG = join(process.cwd(), 'docs', 'rules', 'frontend', 'shared-capabilities.md');

/**
 * 把 camelCase 的 hook 名转成 kebab-case 文件名。
 *
 * @param hookName - 例如 useRequest。
 * @returns 例如 use-request.ts。
 */
function toFileName(hookName: string): string {
  return `${hookName.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase()}.ts`;
}

describe('shared capabilities catalog', () => {
  it('should ship a file for every hook advertised in the rules', () => {
    expect(existsSync(CATALOG)).toBe(true);

    const catalog = readFileSync(CATALOG, 'utf8');
    const hookNames = Array.from(
      new Set(Array.from(catalog.matchAll(/\|\s*`(use[A-Za-z0-9]+)`\s*\|/gu), (match) => match[1])),
    );

    expect(hookNames.length).toBeGreaterThan(0);
    expect(hookNames.filter((name) => !existsSync(join(HOOKS_ROOT, toFileName(name))))).toEqual([]);
  });
});
