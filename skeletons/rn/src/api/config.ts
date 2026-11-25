const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const VALID_API_ENVIRONMENTS = new Set<ApiEnvironment>(['development', 'staging', 'test', 'production', 'mock']);

/**
 * 后端环境标识，取值与 `EXPO_PUBLIC_APP_ENV` 对齐。
 */
export type ApiEnvironment = 'development' | 'staging' | 'test' | 'production' | 'mock';

/**
 * 允许进入客户端 bundle 的 Expo public 环境变量。
 */
export interface IExpoPublicEnv {
  /** analytics 开关。 */
  EXPO_PUBLIC_ANALYTICS_ENABLED?: string;
  /** API 基地址，必须为完整 URL。 */
  EXPO_PUBLIC_API_BASE_URL?: string;
  /** 后端环境。 */
  EXPO_PUBLIC_APP_ENV?: string;
}

/**
 * 运行时 API 配置。
 */
export interface IApiConfig {
  /** analytics 是否启用。 */
  analyticsEnabled: boolean;
  /** 后端环境。 */
  apiEnvironment: ApiEnvironment;
  /** API 基地址，已去掉结尾斜杠。 */
  apiBaseUrl: string;
}

/**
 * 静态读取 Expo public env，确保 Expo CLI 能把 env 文件中的 `EXPO_PUBLIC_*` 注入客户端 bundle。
 *
 * 这是全项目唯一允许读取 `process.env.EXPO_PUBLIC_*` 的位置。
 *
 * @returns 客户端可见的 public 配置。
 */
export function getExpoPublicEnv(): IExpoPublicEnv {
  return {
    EXPO_PUBLIC_ANALYTICS_ENABLED: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  };
}

function readOptionalString(env: IExpoPublicEnv, key: keyof IExpoPublicEnv): string | undefined {
  const value = env[key]?.trim();

  return value ? value : undefined;
}

function readRequiredString(env: IExpoPublicEnv, key: keyof IExpoPublicEnv): string {
  const value = readOptionalString(env, key);

  if (!value) {
    throw new Error(`${key} is required in the loaded Expo public env.`);
  }

  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function readBoolean(env: IExpoPublicEnv, key: keyof IExpoPublicEnv, defaultValue: boolean): boolean {
  const value = readOptionalString(env, key);

  if (value === undefined) return defaultValue;

  return TRUE_ENV_VALUES.has(value.toLowerCase());
}

function readApiEnvironment(env: IExpoPublicEnv): ApiEnvironment {
  const appEnv = readRequiredString(env, 'EXPO_PUBLIC_APP_ENV').toLowerCase();

  if (VALID_API_ENVIRONMENTS.has(appEnv as ApiEnvironment)) {
    return appEnv as ApiEnvironment;
  }

  throw new Error('EXPO_PUBLIC_APP_ENV must be one of development, staging, test, production, mock.');
}

/**
 * 汇总 API 运行时配置；从 env 文件读取，缺失立即 throw，不使用源码 fallback。
 *
 * @param env - 可注入的 public 环境变量，测试场景使用。
 * @returns 运行时 API 配置。
 */
export function readApiConfig(env: IExpoPublicEnv = getExpoPublicEnv()): IApiConfig {
  const apiEnvironment = readApiEnvironment(env);
  const apiBaseUrl = normalizeBaseUrl(readRequiredString(env, 'EXPO_PUBLIC_API_BASE_URL'));

  return {
    analyticsEnabled: readBoolean(env, 'EXPO_PUBLIC_ANALYTICS_ENABLED', false),
    apiEnvironment,
    apiBaseUrl,
  };
}
