import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 文件规模扫描结果。
 */
interface IFileSizeEntry {
  /**
   * 相对仓库根目录的文件路径。
   */
  path: string;
  /**
   * 文件物理行数。
   */
  lineCount: number;
}

const SOURCE_ROOT = join(process.cwd(), 'src');
const HANDWRITTEN_SOURCE_PATTERN = /\.(ts|tsx)$/;
const PAGE_FILE_PATTERN = /(screen|page)\.tsx$/;
const GENERAL_SOFT_LIMIT = 1500;
const PAGE_LIMIT = 450;

/**
 * 递归读取手写源码文件的路径和行数。
 *
 * @param dir - 当前扫描目录。
 * @returns 文件规模扫描结果。
 */
function readFileSizeEntries(dir: string): IFileSizeEntry[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return readFileSizeEntries(absolutePath);
    }

    if (!HANDWRITTEN_SOURCE_PATTERN.test(entry)) {
      return [];
    }

    return [
      {
        path: relative(process.cwd(), absolutePath),
        lineCount: countLines(absolutePath),
      },
    ];
  });
}

/**
 * 读取文件行数；单独封装便于后续排除自动生成文件。
 *
 * @param absolutePath - 文件绝对路径。
 * @returns 文件物理行数。
 */
function countLines(absolutePath: string): number {
  const source = readFileSync(absolutePath, 'utf8');

  return source.length === 0 ? 0 : source.split('\n').length;
}

describe('file split boundary', () => {
  it('should keep handwritten source files below the soft split limit', () => {
    const violations = readFileSizeEntries(SOURCE_ROOT).filter((entry) => entry.lineCount >= GENERAL_SOFT_LIMIT);

    expect(violations).toEqual([]);
  });

  it('should keep page and screen components below the orchestration limit', () => {
    const violations = readFileSizeEntries(SOURCE_ROOT).filter(
      (entry) => PAGE_FILE_PATTERN.test(entry.path) && entry.lineCount > PAGE_LIMIT,
    );

    expect(violations).toEqual([]);
  });
});
