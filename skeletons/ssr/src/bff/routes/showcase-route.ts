import 'server-only';

import { getLocale } from 'next-intl/server';

import { ShowcaseGatewayError } from '../gateway/showcase-gateway';
import { getShowcaseListService } from '../services/showcase-service';

import { createBffErrorResponse, createBffSuccessResponse } from '@/bff/shared/http-response';
import { serverLogger } from '@/bff/shared/logger/server-logger';
import { createRequestContext } from '@/bff/shared/request-context';

/**
 * showcase 列表 Route Handler facade：稳定 HTTP wrapper + 错误归一。
 *
 * @param request - 进入的 HTTP 请求。
 * @returns 统一信封 JSON 响应。
 */
export async function handleGetShowcaseRoute(request: Request): Promise<Response> {
  const locale = await getLocale();
  const context = createRequestContext(request.headers, locale);

  try {
    const data = await getShowcaseListService(context);
    // 公开只读端点：显式 opt-in 短缓存（默认 no-store，此处主动放宽）。
    return createBffSuccessResponse(data, context, {
      cacheControl: 'public, s-maxage=60, stale-while-revalidate=120',
    });
  } catch (error) {
    if (error instanceof ShowcaseGatewayError) {
      return createBffErrorResponse(error.code, error.codeMsg, context, error.status);
    }

    serverLogger.error('showcase route unhandled error', {
      requestId: context.requestId,
      routeId: 'route:showcase',
      fields: { message: error instanceof Error ? error.message : String(error) },
    });
    return createBffErrorResponse('internal_error', 'Unexpected error.', context, 500);
  }
}
