// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDirectory = fileURLToPath(new URL('../..', import.meta.url));
const DATABASE_PACKAGE_NAMES = [
  '@libsql/client',
  '@neondatabase/serverless',
  '@prisma/client',
  'better-sqlite3',
  'drizzle-orm',
  'kysely',
  'mongodb',
  'mongoose',
  'mysql',
  'mysql2',
  'pg',
  'postgres',
  'prisma',
  'sequelize',
  'sqlite3',
  'typeorm',
];

/**
 * 递归收集生产 TypeScript 文件；可选目录不存在时返回空列表，兼容 bff-only 骨架。
 *
 * @param directory - 起始目录绝对路径。
 * @returns 目录中的 TypeScript 文件绝对路径。
 */
function collectTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * 提取静态 import/export source 与字面量 dynamic import，供架构边界扫描使用。
 *
 * @param source - TypeScript 源码。
 * @returns 文件声明的模块引用。
 */
function collectImportSources(source: string): string[] {
  const importSources: string[] = [];
  const staticImportPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gu;
  const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/gu;

  for (const match of source.matchAll(staticImportPattern)) {
    if (match[1]) {
      importSources.push(match[1]);
    }
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    if (match[1]) {
      importSources.push(match[1]);
    }
  }

  return importSources;
}

/**
 * 将项目 alias 或相对引用解析为 `src` 下的标准化目标；第三方包返回 null。
 *
 * @param importerPath - 发起 import 的文件绝对路径。
 * @param importSource - import 中的模块 source。
 * @returns `src` 相对目标或 null。
 */
function resolveSourceTarget(importerPath: string, importSource: string): string | null {
  if (importSource === '@') {
    return '';
  }
  if (importSource.startsWith('@/')) {
    return importSource.slice(2);
  }
  if (importSource.startsWith('.')) {
    return relative(srcDirectory, resolve(dirname(importerPath), importSource)).replaceAll('\\', '/');
  }

  return null;
}

/**
 * 判断模块引用是否命中给定目录本身或其任意子路径。
 *
 * @param target - `src` 下的标准化目标。
 * @param directory - 待匹配目录。
 * @returns 是否命中目录边界。
 */
function targetsDirectory(target: string | null, directory: string): boolean {
  return target === directory || target?.startsWith(`${directory}/`) === true;
}

/**
 * 输出稳定的仓库相对位置，避免测试错误依赖个人机器绝对路径。
 *
 * @param filePath - 文件绝对路径。
 * @returns `src` 下相对路径。
 */
function formatSourcePath(filePath: string): string {
  return relative(srcDirectory, filePath).replaceAll('\\', '/');
}

const sourceFiles = collectTypeScriptFiles(srcDirectory).filter((filePath) => !filePath.includes('/test/'));

describe('next backend architecture boundary', () => {
  it('prevents app and features from importing server implementation', () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const sourcePath = formatSourcePath(filePath);
      if (!sourcePath.startsWith('app/') && !sourcePath.startsWith('features/')) {
        continue;
      }

      for (const importSource of collectImportSources(readFileSync(filePath, 'utf8'))) {
        if (targetsDirectory(resolveSourceTarget(filePath, importSource), 'server')) {
          violations.push(`${sourcePath}: ${importSource}`);
        }
      }
    }

    expect(violations, `app/features 不得穿透 BFF 引用 server:\n${violations.join('\n')}`).toEqual([]);
  });

  it('allows only bff services to import the server application public entry', () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const sourcePath = formatSourcePath(filePath);
      if (!sourcePath.startsWith('bff/')) {
        continue;
      }

      for (const importSource of collectImportSources(readFileSync(filePath, 'utf8'))) {
        const target = resolveSourceTarget(filePath, importSource);
        if (!targetsDirectory(target, 'server')) {
          continue;
        }

        const isBffService = sourcePath.startsWith('bff/services/');
        const isApplicationPublicEntry = target === 'server/application';
        if (!isBffService || !isApplicationPublicEntry) {
          violations.push(`${sourcePath}: ${importSource}`);
        }
      }
    }

    expect(violations, `只有 bff/services 可引用 server/application 公开入口:\n${violations.join('\n')}`).toEqual([]);
  });

  it('prevents server from depending on web entry layers', () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const sourcePath = formatSourcePath(filePath);
      if (!sourcePath.startsWith('server/')) {
        continue;
      }

      for (const importSource of collectImportSources(readFileSync(filePath, 'utf8'))) {
        const target = resolveSourceTarget(filePath, importSource);
        if (
          targetsDirectory(target, 'app') ||
          targetsDirectory(target, 'bff') ||
          targetsDirectory(target, 'features')
        ) {
          violations.push(`${sourcePath}: ${importSource}`);
        }
      }
    }

    expect(violations, `server 不得反向依赖 app/bff/features:\n${violations.join('\n')}`).toEqual([]);
  });

  it('keeps ORM and database SDK imports inside server infrastructure database', () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const sourcePath = formatSourcePath(filePath);
      for (const importSource of collectImportSources(readFileSync(filePath, 'utf8'))) {
        const isDatabasePackage = DATABASE_PACKAGE_NAMES.some(
          (packageName) => importSource === packageName || importSource.startsWith(`${packageName}/`),
        );
        if (isDatabasePackage && !sourcePath.startsWith('server/infrastructure/database/')) {
          violations.push(`${sourcePath}: ${importSource}`);
        }
      }
    }

    expect(violations, `ORM/数据库 SDK 只能位于 server/infrastructure/database:\n${violations.join('\n')}`).toEqual([]);
  });
});
