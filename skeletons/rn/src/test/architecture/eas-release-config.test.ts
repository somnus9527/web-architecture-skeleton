import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 解析 env 文件为键值表；空行与注释忽略。
 *
 * @param relativePath - 相对仓库根的文件路径。
 * @returns 键值表。
 */
function readEnvFile(relativePath: string): Record<string, string> {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');

  return Object.fromEntries(
    source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

interface IEasProfile {
  /** 云构建环境变量。 */
  env?: Record<string, string>;
  /** 是否自动递增版本号。 */
  autoIncrement?: boolean;
  /** 是否 development client。 */
  developmentClient?: boolean;
}

interface IEasConfig {
  /** 构建 profile。 */
  build: Record<string, IEasProfile>;
}

const easConfig = JSON.parse(readFileSync(join(process.cwd(), 'eas.json'), 'utf8')) as IEasConfig;
const profiles = ['development', 'staging', 'production'] as const;

describe('EAS release config', () => {
  it('should declare the required build profiles', () => {
    expect(Object.keys(easConfig.build)).toEqual(expect.arrayContaining([...profiles]));
  });

  it.each(profiles)('should keep %s env in sync with the env contract', (profile) => {
    const contract = readEnvFile(`env/.env.${profile}.example`);
    const easEnv = easConfig.build[profile].env ?? {};

    for (const [key, value] of Object.entries(contract)) {
      if (key.startsWith('EXPO_PUBLIC_')) {
        expect(easEnv[key]).toBe(value);
      }
    }
  });

  it('should point production at the production host and never at mock', () => {
    const productionUrl = easConfig.build.production.env?.EXPO_PUBLIC_API_BASE_URL ?? '';

    expect(productionUrl).toContain('api.example.com');
    expect(productionUrl).not.toContain('127.0.0.1');
    expect(productionUrl).not.toContain('mock');
  });

  it('should keep mock endpoints out of staging and production', () => {
    const mockUrl = readEnvFile('env/.env.mock.example').EXPO_PUBLIC_API_BASE_URL;

    for (const profile of ['staging', 'production'] as const) {
      expect(easConfig.build[profile].env?.EXPO_PUBLIC_API_BASE_URL).not.toBe(mockUrl);
      expect(easConfig.build[profile].env?.EXPO_PUBLIC_API_BASE_URL).not.toContain('127.0.0.1');
    }
  });

  it('should enable version auto increment for store-bound profiles', () => {
    expect(easConfig.build.staging.autoIncrement).toBe(true);
    expect(easConfig.build.production.autoIncrement).toBe(true);
    expect(easConfig.build.development.developmentClient).toBe(true);
  });
});
