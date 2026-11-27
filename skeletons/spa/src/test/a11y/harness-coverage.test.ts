import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 共享 UI 目录：每个 `.tsx` 都必须在 axe 夹具里出现，否则新组件就逃过了无障碍检查。
 */
const UI_DIRECTORY = join(process.cwd(), 'src/shared/ui');

/**
 * 夹具源码：只挂载、不被应用引用。
 */
const HARNESS_FILE = join(process.cwd(), 'src/test/a11y/harness.tsx');

/**
 * 把 kebab-case 文件名转成组件名。
 *
 * @param file - 例如 `page-header.tsx`。
 * @returns 例如 `PageHeader`。
 */
function toComponentName(file: string): string {
  return file
    .replace(/\.tsx$/u, '')
    .split('-')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
}

/**
 * 递归列出源码文件（排除夹具自身所在目录）。
 *
 * @param relativePath - 相对 `src` 的目录。
 * @returns 相对 `src` 的文件名列表。
 */
function listSourceFiles(relativePath = ''): string[] {
  const absolute = join(process.cwd(), 'src', relativePath);

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : listSourceFiles(join(relativePath, entry.name));
    }

    return /\.tsx?$/u.test(entry.name) ? [join(relativePath, entry.name)] : [];
  });
}

const harnessSource = readFileSync(HARNESS_FILE, 'utf8');
const componentFiles = readdirSync(UI_DIRECTORY).filter((file) => file.endsWith('.tsx'));

describe('a11y harness coverage', () => {
  it('should mount every shared UI primitive in the axe harness', () => {
    const missing = componentFiles.filter((file) => {
      const componentName = toComponentName(file);

      return !new RegExp(`\\b${componentName}\\b`, 'u').test(harnessSource);
    });

    expect(missing, '新增共享组件后必须同步进 src/test/a11y/harness.tsx，否则无障碍检查会漏掉它').toEqual([]);
  });

  it('should keep the harness out of application code', () => {
    const offenders = listSourceFiles().filter((file) =>
      readFileSync(join(process.cwd(), 'src', file), 'utf8').includes('test/a11y'),
    );

    expect(offenders, '夹具只允许被 a11y.html 引用，不得进入应用源码').toEqual([]);
  });
});
