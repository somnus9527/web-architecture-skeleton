import { z } from 'zod';

const publicConfigSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['mock', 'dev', 'test', 'prod']),
  NEXT_PUBLIC_APP_ORIGIN: z.url(),
});

/**
 * 客户端可读的公开配置。仅暴露 NEXT_PUBLIC_* 值，绝不含任何 secret。
 */
export interface IPublicConfig {
  /**
   * 当前业务环境。
   */
  appEnv: 'mock' | 'dev' | 'test' | 'prod';
  /**
   * 当前站点 origin，用于客户端构造绝对 URL。
   */
  appOrigin: string;
}

let cachedPublicConfig: IPublicConfig | undefined;

/**
 * 读取并校验公开配置。Client 只能从这里读取 env，禁止散读 `process.env`。
 *
 * @returns 已映射的公开配置。
 */
export function getPublicConfig(): IPublicConfig {
  if (cachedPublicConfig) {
    return cachedPublicConfig;
  }

  const parsed = publicConfigSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join('; ');
    throw new Error(`Invalid public config: ${details}`);
  }

  cachedPublicConfig = {
    appEnv: parsed.data.NEXT_PUBLIC_APP_ENV,
    appOrigin: parsed.data.NEXT_PUBLIC_APP_ORIGIN,
  };

  return cachedPublicConfig;
}
