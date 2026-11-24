import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 源码文件条目。
 */
export interface ISourceFile {
  /**
   * 相对仓库根目录的路径，统一使用 /。
   */
  path: string;
  /**
   * 相对 src/ 的路径。
   */
  srcPath: string;
  /**
   * 文件文本。
   */
  content: string;
}

/**
 * 例外条目。
 */
export interface IArchitectureException {
  /**
   * 相对仓库根目录的路径。
   */
  path: string;
  /**
   * 放行原因。
   */
  reason: string;
  /**
   * 到期日（YYYY-MM-DD），过期后例外失效。
   */
  expiresAt: string;
}

const SOURCE_PATTERN = /\.(ts|tsx)$/u;
const EXCEPTIONS_PATH = '.agents/architecture-exceptions.json';

/**
 * 递归列出 src 下的手写源码文件。
 *
 * @param sourceRoot - src 绝对路径。
 * @returns 源码文件列表。
 */
export function listSourceFiles(sourceRoot: string): ISourceFile[] {
  const walk = (directory: string): ISourceFile[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        return walk(absolute);
      }
      if (!SOURCE_PATTERN.test(entry.name)) {
        return [];
      }

      return [
        {
          path: relative(process.cwd(), absolute),
          srcPath: relative(sourceRoot, absolute),
          content: readFileSync(absolute, 'utf8'),
        },
      ];
    });

  return walk(sourceRoot);
}

/**
 * 读取例外清单，并过滤掉已过期的条目。
 *
 * @returns 生效的例外路径集合。
 */
export function readExceptions(): Set<string> {
  const absolute = join(process.cwd(), EXCEPTIONS_PATH);
  if (!existsSync(absolute)) {
    return new Set();
  }

  const entries = JSON.parse(readFileSync(absolute, 'utf8')) as IArchitectureException[];
  const today = new Date().toISOString().slice(0, 10);

  return new Set(entries.filter((entry) => entry.expiresAt >= today).map((entry) => entry.path));
}

/**
 * 判断文件是否标记为生成代码。
 *
 * @param content - 文件文本。
 * @returns 是否生成代码。
 */
export function isGenerated(content: string): boolean {
  return /@generated/u.test(content.slice(0, 400));
}

/**
 * 把违规清单格式化为断言消息，避免只看到空数组。
 *
 * @param violations - 违规描述。
 * @returns 断言消息。
 */
export function describeViolations(violations: string[]): string {
  return violations.length === 0 ? '无违规' : `\n${violations.join('\n')}`;
}
