import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 源码文件扫描结果。
 */
interface ISourceFile {
  /**
   * 相对仓库根目录的文件路径。
   */
  path: string;
  /**
   * 文件文本内容。
   */
  content: string;
}

const SOURCE_ROOT = join(process.cwd(), 'src');
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;

/**
 * 递归读取源码文件，用于执行轻量架构边界检查。
 *
 * @param dir - 当前扫描目录。
 * @returns 源码文件列表。
 */
function readSourceFiles(dir: string): ISourceFile[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return readSourceFiles(absolutePath);
    }

    if (!SOURCE_FILE_PATTERN.test(entry)) {
      return [];
    }

    return [
      {
        path: relative(process.cwd(), absolutePath),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

describe('architecture layer boundary', () => {
  it('should keep cross-directory imports on the source alias', () => {
    const violations = readSourceFiles(SOURCE_ROOT)
      .filter((file) => !file.path.startsWith('src/test/'))
      .flatMap((file) => {
        const matches = file.content.matchAll(/from ['"]\.\.\//g);

        return Array.from(matches, () => file.path);
      });

    expect(violations).toEqual([]);
  });
});
