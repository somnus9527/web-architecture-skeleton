/**
 * CSP 策略构造。
 *
 * 抽成纯函数的原因：策略是安全边界，必须有单测；放在 proxy 里既不好测，也容易被顺手改坏。
 * nonce 由 proxy 每请求生成后传入，生产环境 `script-src` 不再包含 `unsafe-inline`。
 */

/** 构造参数。 */
export interface ICspOptions {
  /** 每请求生成的 nonce，生产环境必传。 */
  nonce?: string;
  /** 是否开发环境；默认读 `NODE_ENV`。 */
  isDevelopment?: boolean;
}

/**
 * 构造 Content-Security-Policy 头值。
 *
 * 约束说明：
 * - 生产 `script-src` 只有 `'self'` 与本次请求的 nonce，inline script 必须带 nonce 才能执行；
 * - 开发环境保留 `'unsafe-inline'` 与 `'unsafe-eval'`，React Refresh 与错误浮层依赖它们；
 * - `style-src` 保留 `'unsafe-inline'`：antd 的 cssinjs 在运行时注入 style 标签，nonce 化样式需要改造
 *   整套样式注入（原注释写的 Emotion 已随 MUI 一起移除，理由已更正）；
 * - `object-src 'none'` 显式关掉插件内容，避免 `default-src` 兜底被放宽时留下缺口。
 *
 * @param options - nonce 与环境。
 * @returns CSP 头值。
 */
export function buildContentSecurityPolicy(options: ICspOptions = {}): string {
  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV !== 'production';
  const scriptSources = ["'self'"];

  if (isDevelopment) {
    scriptSources.push("'unsafe-inline'", "'unsafe-eval'");
  } else if (options.nonce) {
    scriptSources.push(`'nonce-${options.nonce}'`);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources.join(' ')}`,
    "connect-src 'self'",
  ].join('; ');
}
