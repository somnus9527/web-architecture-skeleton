import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const CATALOG = join(process.cwd(), 'docs', 'rules', 'frontend', 'ui-style-and-components.md');

describe('shared ui catalog', () => {
  it('should ship every component advertised as built in', () => {
    const catalog = readFileSync(CATALOG, 'utf8');
    const section = catalog.split('## 骨架已内置')[1]?.split('## 派生项目自建')[0] ?? '';
    const paths = Array.from(section.matchAll(/`(src\/shared\/[^`]+\.tsx)`/gu), (match) => match[1]);

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !existsSync(join(process.cwd(), path)))).toEqual([]);
  });

  it('should require every shared ui component to be registered in the catalog (UI-003)', () => {
    // 反向校验看整篇文档：变体专属组件登记在末尾的变体补段里，同样算已登记。
    const catalog = readFileSync(CATALOG, 'utf8');
    const shipped = readdirSync(join(process.cwd(), 'src', 'shared', 'ui'))
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => `src/shared/ui/${name}`);

    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.filter((path) => !catalog.includes(path))).toEqual([]);
  });
});
