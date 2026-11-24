import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles, readExceptions } from '@/test/architecture/support/scan';

const FEATURES_ROOT = join(process.cwd(), 'src', 'features');
const HOOK_FILE_PATTERN = /(?:^|\/)use-[a-z0-9-]+\.tsx?$/u;
const REQUEST_STATE_PATTERN = /setLoading|setIsLoading|setLoadState|setError/u;
const SHARED_HOOK_IMPORT = /@\/shared\/hooks/u;
const RAW_BROWSER_API = /\b(?:localStorage|sessionStorage|matchMedia)\b/u;

describe('hook duplication', () => {
  it('should not hand-roll the request state machine outside src/shared/hooks', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(FEATURES_ROOT)
      .filter((file) => HOOK_FILE_PATTERN.test(file.srcPath) && !exceptions.has(file.path))
      .filter((file) => /useEffect/u.test(file.content) && REQUEST_STATE_PATTERN.test(file.content))
      .filter((file) => !SHARED_HOOK_IMPORT.test(file.content))
      .map((file) => `${file.srcPath} 手写请求三态，请改用 @/shared/hooks 的 useRequest`);

    expect(violations).toEqual([]);
  });

  it('should not call browser storage or media queries directly inside features', () => {
    const exceptions = readExceptions();
    const violations = listSourceFiles(FEATURES_ROOT)
      .filter((file) => !exceptions.has(file.path) && !/\.test\.tsx?$/u.test(file.srcPath))
      .filter((file) => RAW_BROWSER_API.test(file.content))
      .map((file) => `${file.srcPath} 直接访问浏览器存储或 media query，请经 store 或共享 hook`);

    expect(violations).toEqual([]);
  });
});
