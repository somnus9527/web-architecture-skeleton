/**
 * 外部 URL / deep link 白名单。
 *
 * 业务方按项目实际域名修改这里；不要把 host 白名单写进业务代码。
 * App scheme 与 app.json 的 `expo.scheme` 保持一致，初始化器会同步替换。
 */
export const APP_DEEP_LINK_SCHEME = 'rnapp';

/**
 * 精确允许的 HTTPS host。
 */
export const ALLOWED_EXTERNAL_HOSTS: readonly string[] = ['example.com', 'www.example.com'];

/**
 * 允许的 HTTPS host 后缀，用于覆盖受信域名的子域。
 */
export const ALLOWED_EXTERNAL_HOST_SUFFIXES: readonly string[] = ['.example.com'];
