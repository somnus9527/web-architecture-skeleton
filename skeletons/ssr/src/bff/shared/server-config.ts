import 'server-only';

import { Buffer } from 'node:buffer';

import { z } from 'zod';

const envNameSchema = z.enum(['mock', 'dev', 'test', 'prod']);
const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const serverConfigSchema = z
  .object({
    APP_ENV: envNameSchema,
    APP_ORIGIN: z.url(),
    BACKEND_API_BASE_URL: z.url().optional(),
    PRISM_MOCK_BASE_URL: z.url().optional(),
    LOG_LEVEL: logLevelSchema,
    SESSION_COOKIE_NAME: z.literal('ssr_app_auth'),
    SESSION_COOKIE_SECURE: z
      .string()
      .transform((value) => value === 'true')
      .pipe(z.boolean()),
    CSRF_ENABLED: z
      .string()
      .transform((value) => value === 'true')
      .pipe(z.boolean()),
    NEXT_PUBLIC_APP_ENV: envNameSchema,
    NEXT_PUBLIC_APP_ORIGIN: z.url(),
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.NEXT_PUBLIC_APP_ENV !== value.APP_ENV) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_APP_ENV'],
        message: 'NEXT_PUBLIC_APP_ENV must match APP_ENV.',
      });
    }

    if (value.NEXT_PUBLIC_APP_ORIGIN !== value.APP_ORIGIN) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_APP_ORIGIN'],
        message: 'NEXT_PUBLIC_APP_ORIGIN must match APP_ORIGIN.',
      });
    }

    if (value.APP_ENV === 'mock' && !value.PRISM_MOCK_BASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['PRISM_MOCK_BASE_URL'],
        message: 'PRISM_MOCK_BASE_URL is required when APP_ENV is mock.',
      });
    }

    if (value.APP_ENV !== 'mock' && !value.BACKEND_API_BASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['BACKEND_API_BASE_URL'],
        message: 'BACKEND_API_BASE_URL is required outside mock.',
      });
    }

    if (value.APP_ENV === 'prod') {
      validateProductionUrls(value, context);
      validateServerActionKey(value.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, context);

      if (!value.SESSION_COOKIE_SECURE) {
        context.addIssue({
          code: 'custom',
          path: ['SESSION_COOKIE_SECURE'],
          message: 'SESSION_COOKIE_SECURE must be true in prod.',
        });
      }

      if (!value.CSRF_ENABLED) {
        context.addIssue({
          code: 'custom',
          path: ['CSRF_ENABLED'],
          message: 'CSRF_ENABLED must be true in prod.',
        });
      }
    }
  });

/**
 * 服务端运行时配置字段：BFF 出站、日志、安全 cookie 与 Server Action key。
 */
export interface IServerConfig {
  /**
   * 当前业务环境，与 `NODE_ENV` 解耦。
   */
  appEnv: 'mock' | 'dev' | 'test' | 'prod';
  /**
   * 当前站点 origin，用于安全 header、回调与 public config 对齐。
   */
  appOrigin: string;
  /**
   * 真实后端 API base URL，只有远程 gateway 使用。
   */
  backendApiBaseUrl?: string;
  /**
   * Prism mock server base URL，mock 环境 gateway 从这里读取。
   */
  prismMockBaseUrl?: string;
  /**
   * 服务端日志级别。
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /**
   * 同源 httpOnly 会话 cookie 名称。
   */
  sessionCookieName: 'ssr_app_auth';
  /**
   * 会话 cookie 是否必须 secure。
   */
  isSessionCookieSecure: boolean;
  /**
   * 当前环境是否启用 CSRF 防护。
   */
  isCsrfEnabled: boolean;
  /**
   * Server Action 多实例稳定性密钥，只能在服务端读取。
   */
  serverActionsEncryptionKey: string;
}

let cachedServerConfig: IServerConfig | undefined;

/**
 * 校验生产 URL，避免 prod 构建误指向 mock、localhost 或非 HTTPS 公开地址。
 *
 * @param value - 已通过基础 schema 的 env 对象。
 * @param context - Zod issue 收集上下文。
 */
function validateProductionUrls(value: z.infer<typeof serverConfigSchema>, context: z.RefinementCtx): void {
  const appOrigin = new URL(value.APP_ORIGIN);
  const productionUrls = [['APP_ORIGIN', appOrigin]] as Array<[string, URL]>;
  if (value.BACKEND_API_BASE_URL) {
    productionUrls.push(['BACKEND_API_BASE_URL', new URL(value.BACKEND_API_BASE_URL)]);
  }

  for (const [path, url] of productionUrls) {
    if (url.protocol !== 'https:') {
      context.addIssue({ code: 'custom', path: [path], message: `${path} must use https in prod.` });
    }

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      context.addIssue({ code: 'custom', path: [path], message: `${path} must not point to localhost in prod.` });
    }
  }
}

/**
 * 校验 Server Action key 是否为 16/24/32 字节 AES key 的 base64 文本。
 *
 * @param encodedKey - env 注入的 base64 key。
 * @param context - Zod issue 收集上下文。
 */
function validateServerActionKey(encodedKey: string, context: z.RefinementCtx): void {
  const keyLength = Buffer.from(encodedKey, 'base64').byteLength;
  if (![16, 24, 32].includes(keyLength)) {
    context.addIssue({
      code: 'custom',
      path: ['NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'],
      message: 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must decode to 16, 24, or 32 bytes.',
    });
  }
}

/**
 * 将 Zod 校验错误转换为启动期可读的 fail-fast 错误。
 *
 * @param error - Zod schema 返回的错误对象。
 * @returns 带缺失 key 与原因摘要的 Error。
 */
function buildConfigError(error: z.ZodError): Error {
  const details = error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join('; ');
  return new Error(`Invalid server runtime config: ${details}`);
}

/**
 * 从环境变量读取并校验服务端配置，失败时在启动或首次渲染阶段直接抛错。
 *
 * @returns 已映射为业务字段名的服务端配置。
 */
export function getServerConfig(): IServerConfig {
  if (cachedServerConfig) {
    return cachedServerConfig;
  }

  const parsedConfig = serverConfigSchema.safeParse(process.env);
  if (!parsedConfig.success) {
    throw buildConfigError(parsedConfig.error);
  }

  cachedServerConfig = {
    appEnv: parsedConfig.data.APP_ENV,
    appOrigin: parsedConfig.data.APP_ORIGIN,
    backendApiBaseUrl: parsedConfig.data.BACKEND_API_BASE_URL,
    prismMockBaseUrl: parsedConfig.data.PRISM_MOCK_BASE_URL,
    logLevel: parsedConfig.data.LOG_LEVEL,
    sessionCookieName: parsedConfig.data.SESSION_COOKIE_NAME,
    isSessionCookieSecure: parsedConfig.data.SESSION_COOKIE_SECURE,
    isCsrfEnabled: parsedConfig.data.CSRF_ENABLED,
    serverActionsEncryptionKey: parsedConfig.data.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
  };

  return cachedServerConfig;
}

/**
 * 显式触发服务端配置校验，供 layout、脚本或健康检查入口 fail-fast。
 */
export function validateServerConfig(): void {
  getServerConfig();
}
