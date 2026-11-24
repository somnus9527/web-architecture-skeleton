import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles, readExceptions } from '@/test/architecture/support/scan';

const FEATURES_ROOT = join(process.cwd(), 'src', 'features');
const IMPORT_PATTERN = /from\s+['"]@\/features\/([^/'"]+)/gu;

describe('feature isolation', () => {
  it('should not let one feature import another feature', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(FEATURES_ROOT)
      .filter((file) => !exceptions.has(file.path))
      .flatMap((file) => {
        const owner = file.srcPath.split('/')[0];
        const imported = Array.from(file.content.matchAll(IMPORT_PATTERN), (match) => match[1]);

        return imported
          .filter((name) => name !== owner && name !== 'shared')
          .map((name) => `${file.srcPath} 跨 feature 依赖 ${name}`);
      });

    expect(violations).toEqual([]);
  });
});
