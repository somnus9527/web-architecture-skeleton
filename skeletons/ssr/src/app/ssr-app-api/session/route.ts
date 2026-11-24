import { unstable_rethrow } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { handleGetSessionRoute } from '@/bff/routes/session-route';

/**
 * session 端点。仅验证浏览器会话 cookie，不向客户端返回 token。
 *
 * @param request - HTTP 请求。
 * @returns 统一信封响应。
 */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleGetSessionRoute(request, await getLocale());
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}
