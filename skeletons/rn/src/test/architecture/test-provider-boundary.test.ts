import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TEST_PROVIDERS = 'src/test/utils/test-providers.tsx';

/**
 * 递归列出测试目录下的测试文件。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对仓库根的文件路径列表。
 */
function listTestFiles(relativePath: string): string[] {
  const absolute = join(process.cwd(), relativePath);

  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return listTestFiles(child);
    }

    return /\.test\.tsx?$/u.test(entry.name) ? [child] : [];
  });
}

describe('rn test provider boundary', () => {
  it('should provide the shared TestProviders helper', () => {
    expect(existsSync(join(process.cwd(), TEST_PROVIDERS))).toBe(true);
  });

  it('should not create QueryClient directly inside test files', () => {
    const offenders = listTestFiles('src/test')
      .filter((file) => file !== TEST_PROVIDERS)
      .filter((file) => /new QueryClient\s*\(/u.test(readFileSync(join(process.cwd(), file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
