import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles, readExceptions } from '@/test/architecture/support/scan';

const UI_ROOT = join(process.cwd(), 'src', 'shared', 'ui');

describe('shared ui contract', () => {
  it('should not depend on feature code', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(UI_ROOT)
      .filter((file) => !exceptions.has(file.path) && /from\s+['"]@\/features\//u.test(file.content))
      .map((file) => `${file.srcPath} 引用了 feature 代码`);

    expect(violations).toEqual([]);
  });

  it('should not translate copy inside shared components', () => {
    const violations = listSourceFiles(UI_ROOT)
      .filter((file) => /\bt\(/u.test(file.content))
      .map((file) => `${file.srcPath} 调用了 t()，文案应由调用方注入`);

    expect(violations).toEqual([]);
  });
});
