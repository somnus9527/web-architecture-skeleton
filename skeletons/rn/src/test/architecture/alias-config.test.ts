import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 规则 `docs/rules/rn/typescript.md` 声明的七组 path alias，加上 `@/*` 兜底。
 */
const EXPECTED_ALIASES: Record<string, string> = {
  '@app/*': './app/*',
  '@api/*': './src/api/*',
  '@components/*': './src/components/*',
  '@domain/*': './src/domain/*',
  '@storage/*': './src/storage/*',
  '@theme/*': './src/theme/*',
  '@test/*': './src/test/*',
  '@/*': './src/*',
};

interface ITsConfigShape {
  compilerOptions?: {
    strict?: boolean;
    paths?: Record<string, string[]>;
  };
}

/**
 * 读取并解析 tsconfig.json。
 *
 * @returns tsconfig 结构。
 */
function readTsConfig(): ITsConfigShape {
  return JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8')) as ITsConfigShape;
}

/**
 * 读取 jest 配置文本。
 *
 * @returns jest.config.js 内容。
 */
function readJestConfig(): string {
  return readFileSync(join(process.cwd(), 'jest.config.js'), 'utf8');
}

describe('rn path alias config', () => {
  it('should declare exactly the seven aliases plus the @/* fallback', () => {
    const paths = readTsConfig().compilerOptions?.paths ?? {};

    expect(paths).toEqual(
      Object.fromEntries(Object.entries(EXPECTED_ALIASES).map(([alias, target]) => [alias, [target]])),
    );
  });

  it('should map every alias in the jest moduleNameMapper', () => {
    const jestConfig = readJestConfig();

    for (const alias of Object.keys(EXPECTED_ALIASES)) {
      const prefix = alias.replace('/*', '/');

      expect(jestConfig).toContain(`'^${prefix}(.*)$'`);
    }
  });

  it('should keep TypeScript strict mode on', () => {
    expect(readTsConfig().compilerOptions?.strict).toBe(true);
  });
});
