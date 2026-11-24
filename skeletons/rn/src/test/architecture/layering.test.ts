import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 递归列出指定目录下的源码文件。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对仓库根的文件路径列表。
 */
function listSources(relativePath: string): string[] {
  const absolute = join(process.cwd(), relativePath);

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

describe('rn architecture layering', () => {
  it('should keep the app router shell free of api and fetch access', () => {
    expect(findViolations('app', ['@/api', '@/storage'])).toEqual([]);

    const offenders = listSources('app').filter((file) =>
      /\bfetch\s*\(/u.test(readFileSync(join(process.cwd(), file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  it('should keep domain free of view and component dependencies', () => {
    expect(findViolations('src/domain', ['react-native', 'react-native-paper', 'expo-router', '@/components'])).toEqual(
      [],
    );
  });

  it('should let api depend only on domain contracts', () => {
    expect(findViolations('src/api', ['react-native', 'react-native-paper', '@/components', '@/storage'])).toEqual([]);
    expect(findViolations('src/api', ['@/domain'], ['@/domain/contracts'])).toEqual([]);
  });

  it('should keep storage access behind src/storage', () => {
    const storageModules = ['expo-secure-store', '@react-native-async-storage/async-storage'];
    const offenders = ['app', 'src/api', 'src/components', 'src/domain'].flatMap((directory) =>
      findViolations(directory, storageModules),
    );

    expect(offenders).toEqual([]);
  });

  it('should keep components free of direct network and storage access', () => {
    const offenders = listSources('src/components').filter((file) =>
      /\bfetch\s*\(/u.test(readFileSync(join(process.cwd(), file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
