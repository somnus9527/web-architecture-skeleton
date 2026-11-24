import { existsSync, readFileSync } from 'node:fs';
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
});
