import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * UI catalog 条目。
 */
interface IUiCatalogEntry {
  name: string;
  path: string;
  export: string;
  status: 'stable' | 'deprecated';
  since: string;
  owner: string;
  scope: 'skeleton' | 'project';
  dom: 'native-backed' | 'aria-pattern' | 'static';
  a11y: string[];
  variants?: string[];
  replacedBy?: string;
}

const UI_DIR = join(process.cwd(), 'src', 'shared', 'ui');
const CATALOG_PATH = join(process.cwd(), 'docs', 'ui-catalog.json');
const DOC_PATH = join(process.cwd(), 'docs', 'rules', 'frontend', 'ui-style-and-components.md');
const SOURCE_PATH = join(process.cwd(), '.agents', 'architecture-source.json');

/**
 * 读取当前变体。
 *
 * @returns {string} 变体名。
 */
function readVariant(): string {
  return JSON.parse(readFileSync(SOURCE_PATH, 'utf8')).variant as string;
}

/**
 * 读取 catalog，并只保留适用于当前变体的条目。
 *
 * @param {string} variant - 变体名。
 * @returns {IUiCatalogEntry[]} 适用条目。
 */
function readCatalog(variant: string): IUiCatalogEntry[] {
  const entries = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as IUiCatalogEntry[];
  return entries.filter((entry) => !entry.variants || entry.variants.includes(variant));
}

describe('shared ui catalog', () => {
  it('should keep the catalog complete and consistent', () => {
    const entries = readCatalog(readVariant());

    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length);

    for (const entry of entries) {
      expect(['stable', 'deprecated']).toContain(entry.status);
      expect(['skeleton', 'project']).toContain(entry.scope);
      expect(['native-backed', 'aria-pattern', 'static']).toContain(entry.dom);
      expect(entry.owner.length).toBeGreaterThan(0);
      expect(entry.a11y.length).toBeGreaterThan(0);
      if (entry.status === 'deprecated') {
        expect(entry.replacedBy, `${entry.name} 缺少 replacedBy`).toBeTruthy();
      }
    }
  });

  it('should point at existing files that export the declared symbol', () => {
    const entries = readCatalog(readVariant());
    const missing = entries.filter((entry) => !existsSync(join(process.cwd(), entry.path)));

    expect(missing.map((entry) => entry.path)).toEqual([]);

    for (const entry of entries) {
      const source = readFileSync(join(process.cwd(), entry.path), 'utf8');
      const exported = new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const|class)\\s+${entry.export}\\b|export\\s*\\{[^}]*\\b${entry.export}\\b`,
        'u',
      );
      expect(source, `${entry.path} 未导出 ${entry.export}`).toMatch(exported);
    }
  });

  it('should export every catalog component from the barrel', () => {
    const barrel = readFileSync(join(UI_DIR, 'index.ts'), 'utf8');
    const missing = readCatalog(readVariant())
      .map((entry) => entry.name)
      .filter((name) => !new RegExp(`\\b${name}\\b`, 'u').test(barrel));

    expect(missing).toEqual([]);
  });

  it('should register every shared ui component', () => {
    const registered = new Set(readCatalog(readVariant()).map((entry) => entry.path));
    const files = readdirSync(UI_DIR)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => `src/shared/ui/${name}`);

    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => !registered.has(file))).toEqual([]);
  });

  it('should keep the catalog and the rule document in sync', () => {
    const document = readFileSync(DOC_PATH, 'utf8');
    const entries = readCatalog(readVariant());

    expect(entries.filter((entry) => !document.includes(entry.path)).map((entry) => entry.path)).toEqual([]);

    const documented = Array.from(document.matchAll(/`(src\/shared\/ui\/[^`]+\.tsx)`/gu), (match) => match[1]);
    expect(documented.filter((path) => !existsSync(join(process.cwd(), path)))).toEqual([]);
  });
});
