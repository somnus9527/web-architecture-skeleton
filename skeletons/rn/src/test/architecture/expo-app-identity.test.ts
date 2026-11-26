import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 反向域名标识：iOS bundleIdentifier 与 Android package 共用同一形态。
 */
const REVERSE_DNS_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/u;

/**
 * URL scheme：只允许小写字母开头，携带字母、数字与 `+.-`。
 */
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/u;

/** kebab-case slug。 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Semantic Versioning 主版本段。 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/u;

/** 需要与 app 身份保持一致的 EAS profile。 */
const STORE_PROFILES = ['staging', 'production'] as const;

interface IAppConfig {
  /** Expo 应用配置。 */
  expo: {
    name?: string;
    slug?: string;
    version?: string;
    scheme?: string;
    orientation?: string;
    ios?: { bundleIdentifier?: string; buildNumber?: string };
    android?: { package?: string; versionCode?: number };
  };
}

interface IEasConfig {
  /** 构建 profile。 */
  build: Record<string, { autoIncrement?: boolean; env?: Record<string, string> }>;
}

const appConfig = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')) as IAppConfig;
const easConfig = JSON.parse(readFileSync(join(process.cwd(), 'eas.json'), 'utf8')) as IEasConfig;

/**
 * 读取 env 模板中的某个键。
 *
 * @param profile - profile 名。
 * @param key - 环境变量名。
 * @returns 取值；未声明时返回 undefined。
 */
function readEnvValue(profile: string, key: string): string | undefined {
  const source = readFileSync(join(process.cwd(), `env/.env.${profile}.example`), 'utf8');
  const line = source
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));

  return line?.slice(key.length + 1);
}

describe('rn expo app identity', () => {
  it('should declare a complete display identity', () => {
    const { name, slug, version, scheme, orientation } = appConfig.expo;

    expect(typeof name).toBe('string');
    expect((name ?? '').trim().length).toBeGreaterThan(0);
    expect(slug).toMatch(SLUG_PATTERN);
    expect(version).toMatch(SEMVER_PATTERN);
    expect(scheme).toMatch(URL_SCHEME_PATTERN);
    expect(typeof orientation).toBe('string');
  });

  it('should share one reverse-DNS identifier across iOS and Android', () => {
    const bundleIdentifier = appConfig.expo.ios?.bundleIdentifier ?? '';
    const androidPackage = appConfig.expo.android?.package ?? '';

    expect(bundleIdentifier).toMatch(REVERSE_DNS_PATTERN);
    expect(androidPackage).toMatch(REVERSE_DNS_PATTERN);
    expect(androidPackage).toBe(bundleIdentifier);
  });

  it('should keep build numbers numeric so stores can auto increment them', () => {
    expect(appConfig.expo.ios?.buildNumber).toMatch(/^\d+$/u);
    expect(Number.isInteger(appConfig.expo.android?.versionCode)).toBe(true);
    expect(appConfig.expo.android?.versionCode ?? 0).toBeGreaterThan(0);
  });

  it('should enable auto increment on store-bound EAS profiles', () => {
    for (const profile of STORE_PROFILES) {
      expect(easConfig.build[profile]?.autoIncrement).toBe(true);
    }
  });

  it('should keep the store package name in sync across profiles', () => {
    const androidPackage = appConfig.expo.android?.package;

    expect(androidPackage).toBeDefined();

    for (const profile of ['development', ...STORE_PROFILES]) {
      expect(readEnvValue(profile, 'EXPO_PUBLIC_ANDROID_APP_PACKAGE_NAME')).toBe(androidPackage);
    }
  });
});
