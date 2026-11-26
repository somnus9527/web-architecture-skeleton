import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '@/test/architecture/support/scan';

const ROOT = process.cwd();

function isProvider(filePath: string): boolean {
  return (
    filePath === 'app/providers.tsx' ||
    filePath.startsWith('app/providers/') ||
    filePath.startsWith('shared/ui/') ||
    filePath === 'shared/theme/antd-theme.ts'
  );
}

describe('UI stack boundary', () => {
  it('keeps antd imports inside shared/ui and app providers', () => {
    const violations = listSourceFiles(join(ROOT, 'src'))
      .filter((file) => /from\s+['"](?:antd|@ant-design\/icons|@ant-design\/nextjs-registry)['"]/u.test(file.content))
      .filter((file) => !isProvider(file.srcPath))
      .map((file) => `${file.srcPath} 直接引用了 antd，请改从 @/shared/ui 导入`);

    expect(violations).toEqual([]);
  });

  it('does not ship MUI, Emotion or Tailwind dependencies', () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });

    expect(names.filter((name) => /^(?:@mui\/|@emotion\/|tailwindcss$|@tailwindcss\/)/u.test(name))).toEqual([]);
  });

  it('does not import Tailwind CSS', () => {
    const violations = listSourceFiles(join(ROOT, 'src'))
      .filter((file) => /@import\s+['"]tailwindcss['"]/u.test(file.content))
      .map((file) => file.srcPath);

    expect(violations).toEqual([]);
  });
});
