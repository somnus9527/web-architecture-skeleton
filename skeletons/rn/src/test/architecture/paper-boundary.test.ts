import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 规则允许直接接触 React Native Paper 的三个文件。
 */
const PAPER_ALLOWED_FILES = new Set([
  'src/components/ui/paper-controls.tsx',
  'src/components/providers/paper-theme-provider.tsx',
  'src/theme/paper-theme.ts',
]);

/**
 * 递归列出指定目录下的源码文件；目录不存在时返回空数组。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对仓库根的文件路径列表。
 */
function listSources(relativePath: string): string[] {
  const absolute = join(process.cwd(), relativePath);

  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return listSources(child);
    }

    return /\.tsx?$/u.test(entry.name) ? [child] : [];
  });
}

/**
 * 读取一个文件的 import 来源。
 *
 * @param file - 相对仓库根的文件路径。
 * @returns 导入模块标识列表。
 */
function listImports(file: string): string[] {
  const source = readFileSync(join(process.cwd(), file), 'utf8');

  return [...source.matchAll(/(?:from|require\()\s*'([^']+)'/gu)].map((match) => match[1]);
}

describe('rn paper boundary', () => {
  it('should ship the allowed Paper boundary files', () => {
    for (const file of PAPER_ALLOWED_FILES) {
      expect(existsSync(join(process.cwd(), file))).toBe(true);
    }
  });

  it('should forbid react-native-paper outside the allowed boundary files', () => {
    const offenders = ['app', 'src']
      .flatMap((directory) => listSources(directory))
      .filter((file) => !file.startsWith('src/test/'))
      .filter((file) => !PAPER_ALLOWED_FILES.has(file))
      .filter((file) => listImports(file).includes('react-native-paper'));

    expect(offenders).toEqual([]);
  });
});
