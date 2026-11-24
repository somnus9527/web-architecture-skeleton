import { unstable_rethrow } from 'next/navigation';

import { handleGetShowcaseRoute } from '@/bff/routes/showcase-route';

/**
 * showcase 列表端点。薄 facade，逻辑委托 `bff/routes`。
 *
 * @param request - HTTP 请求。
 * @returns 统一信封响应。
 */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleGetShowcaseRoute(request);
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}
