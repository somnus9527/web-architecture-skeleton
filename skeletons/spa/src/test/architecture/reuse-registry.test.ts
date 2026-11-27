import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 注册表条目。
 */
interface ICapabilityEntry {
  id: string;
  kind: string;
  export: string;
  import: string;
  path: string;
  purpose: string;
  owner: string;
  since: string;
}

const REGISTRY_PATH = join(process.cwd(), 'docs', 'capabilities.json');
const HOOKS_DIR = join(process.cwd(), 'src', 'shared', 'hooks');

/**
 * 读取注册表。
 *
 * @returns {ICapabilityEntry[]} 注册项。
 */
function readRegistry(): ICapabilityEntry[] {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ICapabilityEntry[];
}

describe('shared capability registry', () => {
  it('should keep ids unique and fields complete', () => {
    const entries = readRegistry();

    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(['hook', 'util', 'service']).toContain(entry.kind);
      expect(entry.path.startsWith('src/shared/')).toBe(true);
      expect(entry.purpose.length).toBeGreaterThan(0);
      expect(entry.owner.length).toBeGreaterThan(0);
      expect(entry.import.startsWith('@/shared/')).toBe(true);
    }
  });

  it('should point at existing files that export the declared symbol', () => {
    const entries = readRegistry();
    const missing = entries.filter((entry) => !existsSync(join(process.cwd(), entry.path)));

    expect(missing.map((entry) => entry.path)).toEqual([]);
    for (const entry of entries) {
      const source = readFileSync(join(process.cwd(), entry.path), 'utf8');
      const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|class)\\s+${entry.export}\\b`, 'u');
      expect(source, `${entry.path} 未导出 ${entry.export}`).toMatch(exported);
    }
  });

  it('should register every shared hook file', () => {
    const registered = new Set(readRegistry().map((entry) => entry.path));
    const shipped = readdirSync(HOOKS_DIR)
      .filter((name) => name.endsWith('.ts') && name !== 'index.ts' && !name.endsWith('.test.ts'))
      .map((name) => `src/shared/hooks/${name}`);

    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.filter((file) => !registered.has(file))).toEqual([]);
  });
});
