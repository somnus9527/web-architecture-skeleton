import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 无斜杠 alias 生效后不允许再出现的 `@/` 兜底写法。
 */
const LEGACY_ALIAS_PREFIX = '@/';

/**
 * 后端环境变量只允许在 API 配置模块读取。
 */
const ENV_READER_FILE = 'src/api/config.ts';

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

/**
 * 读取文件文本。
 *
 * @param file - 相对仓库根的文件路径。
 * @returns 文件内容。
 */
function readSource(file: string): string {
  return readFileSync(join(process.cwd(), file), 'utf8');
}

/**
 * 判断导入是否命中给定的前缀集合。
 *
 * @param specifier - 导入模块标识。
 * @param prefixes - 禁止的前缀。
 * @returns 是否命中。
 */
function matchesAny(specifier: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`));
}

/**
 * 收集违反某条规则的导入。
 *
 * @param directory - 被检查的目录。
 * @param forbidden - 禁止的模块前缀。
 * @param allowed - 允许的例外前缀。
 * @returns 违规描述列表。
 */
function findViolations(directory: string, forbidden: string[], allowed: string[] = []): string[] {
  return listSources(directory).flatMap((file) =>
    listImports(file)
      .filter((specifier) => matchesAny(specifier, forbidden) && !matchesAny(specifier, allowed))
      .map((specifier) => `${file} imports ${specifier}`),
  );
}

describe('rn architecture layer boundary', () => {
  it('should keep the app router shell free of api and fetch access', () => {
    expect(findViolations('app', ['@api', '@storage', '@/api', '@/storage'])).toEqual([]);

    const offenders = listSources('app').filter((file) => /\bfetch\s*\(/u.test(readSource(file)));

    expect(offenders).toEqual([]);
  });

  it('should keep domain free of view and component dependencies', () => {
    expect(
      findViolations('src/domain', [
        'react-native',
        'react-native-paper',
        'expo-router',
        '@components',
        '@/components',
      ]),
    ).toEqual([]);
  });

  it('should let api depend only on domain contracts', () => {
    expect(
      findViolations('src/api', [
        'react-native',
        'react-native-paper',
        '@components',
        '@storage',
        '@/components',
        '@/storage',
      ]),
    ).toEqual([]);
    expect(findViolations('src/api', ['@domain', '@/domain'], ['@domain/contracts'])).toEqual([]);
  });

  it('should keep storage access behind src/storage', () => {
    const storageModules = ['expo-secure-store', '@react-native-async-storage/async-storage'];
    const offenders = ['app', 'src/api', 'src/components', 'src/domain'].flatMap((directory) =>
      findViolations(directory, storageModules),
    );

    expect(offenders).toEqual([]);
  });

  it('should keep components free of direct network access', () => {
    const offenders = listSources('src/components').filter((file) => /\bfetch\s*\(/u.test(readSource(file)));

    expect(offenders).toEqual([]);
  });

  it('should not use the legacy @/ alias anywhere in app or src', () => {
    const offenders = ['app', 'src'].flatMap((directory) =>
      listSources(directory).filter((file) =>
        listImports(file).some((specifier) => specifier.startsWith(LEGACY_ALIAS_PREFIX)),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('should only read EXPO_PUBLIC_ env vars inside the api config module', () => {
    const offenders = ['app', 'src']
      .flatMap((directory) => listSources(directory))
      .filter((file) => file !== ENV_READER_FILE && !file.startsWith('src/test/'))
      .filter((file) => /process\.env\.EXPO_PUBLIC_/u.test(readSource(file)));

    expect(offenders).toEqual([]);
  });
});
