import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles, readExceptions } from '@/test/architecture/support/scan';

const SHARED_ROOT = join(process.cwd(), 'src', 'shared');
const FORBIDDEN_PREFIXES = ['@/features/', '@/app/'];
const IMPORT_PATTERN = /from\s+['"](@\/[^'"]+)['"]/gu;

describe('shared independence', () => {
  it('should not let src/shared import app or feature code', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(SHARED_ROOT)
      .filter((file) => !exceptions.has(file.path))
      .flatMap((file) =>
        Array.from(file.content.matchAll(IMPORT_PATTERN), (match) => match[1]).flatMap((specifier) =>
          FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))
            ? [`${file.srcPath} 反向依赖 ${specifier}`]
            : [],
        ),
      );

    expect(violations).toEqual([]);
  });
});
