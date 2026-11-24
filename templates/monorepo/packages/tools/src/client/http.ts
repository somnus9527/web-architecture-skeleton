/**
 * 请求工厂的浏览器入口：只提供通用能力，base URL 与鉴权由调用方注入。
 */
export interface IHttpClientOptions {
  /**
   * 网关地址，由 app 注入，不在这里读取环境变量。
   */
  baseUrl: string;
}

/**
 * 创建 JSON 请求方法。
 *
 * @param options - 客户端配置。
 * @returns 返回解析后 JSON 的请求函数。
 */
export function createJsonClient(options: IHttpClientOptions) {
  return async function getJson<TData>(path: string): Promise<TData> {
    const response = await fetch(`${options.baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }

    return (await response.json()) as TData;
  };
}
