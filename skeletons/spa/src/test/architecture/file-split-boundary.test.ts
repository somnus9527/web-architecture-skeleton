import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isGenerated,
  isTokenOnlyStylesheet,
  listCssFiles,
  listSourceFiles,
  readExceptions,
} from '@/test/architecture/support/scan';

const SOURCE_ROOT = join(process.cwd(), 'src');

/**
 * 分类阈值（行数）。
 */
const LIMITS: Array<{ name: string; pattern: RegExp; limit: number }> = [
  { name: 'page', pattern: /(?:page|screen)\.tsx$/u, limit: 900 },
  { name: 'hook', pattern: /\/hooks\//u, limit: 700 },
  { name: 'service', pattern: /\/services\//u, limit: 700 },
  { name: 'component', pattern: /\/components\//u, limit: 800 },
  { name: 'test', pattern: /^test\//u, limit: 1100 },
];

const HARD_LIMIT = 1300;

/** 普通样式表行数上限；纯 token 文件不设上限。 */
const CSS_LIMIT = 1000;

/**
 * 命中某条分类规则。
 *
 * @param srcPath - 相对 src 的路径。
 * @returns 命中的分类。
 */
function classify(srcPath: string): { name: string; limit: number } {
  const matched = LIMITS.find((entry) => entry.pattern.test(srcPath));

  return matched ?? { name: 'other', limit: 1000 };
}

describe('file split boundary', () => {
  it('should keep every source file under its category limit', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(SOURCE_ROOT)
      .filter((file) => !exceptions.has(file.path) && !isGenerated(file.content))
      .flatMap((file) => {
        const lineCount = file.content.split('\n').length;
        const { name, limit } = classify(file.srcPath);

        return lineCount > limit ? [`${file.srcPath}: ${lineCount} 行超过 ${name} 阈值 ${limit}`] : [];
      });

    expect(violations).toEqual([]);
  });

  it('should keep every source file under the hard limit', () => {
    const violations = listSourceFiles(SOURCE_ROOT)
      .filter((file) => !isGenerated(file.content))
      .flatMap((file) => {
        const lineCount = file.content.split('\n').length;

        return lineCount > HARD_LIMIT ? [`${file.srcPath}: ${lineCount} 行超过硬限 ${HARD_LIMIT}`] : [];
      });

    expect(violations).toEqual([]);
  });

  it('should keep every stylesheet under the css limit unless it only declares tokens', () => {
    const violations = listCssFiles(SOURCE_ROOT)
      .filter((file) => !isTokenOnlyStylesheet(file.content))
      .flatMap((file) => {
        const lineCount = file.content.split('\n').length;

        return lineCount > CSS_LIMIT ? [`${file.srcPath}: ${lineCount} 行超过样式表阈值 ${CSS_LIMIT}`] : [];
      });

    expect(violations).toEqual([]);
  });
});
