import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_LAYOUT = 'app/_layout.tsx';

/**
 * 读取根布局源码。
 *
 * @returns 文件内容。
 */
function readRootLayout(): string {
  return readFileSync(join(process.cwd(), ROOT_LAYOUT), 'utf8');
}

describe('rn root layout discipline', () => {
  it('should not run business requests or read storage in the root layout', () => {
    const source = readRootLayout();

    for (const forbidden of ['useQuery', 'useMutation', 'fetch(', '@api/', '@storage/']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('should only mount AppProviders, StatusBar and the router stack', () => {
    const source = readRootLayout();

    expect(source).toContain('AppProviders');
    expect(source).toContain('<StatusBar');
    expect(source).toContain('<Stack');
    expect(source).not.toContain('<View');
    expect(source).not.toContain('<Text');
  });

  it('should keep the root layout within 30 lines', () => {
    const lines = readRootLayout().split('\n').length;

    expect(lines).toBeLessThanOrEqual(30);
  });
});
