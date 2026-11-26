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
  const startedAt = Date.now();
  const path = new URL(request.url).pathname;
  const hasSessionCookie = Boolean(request.headers.get('cookie'));

  serverLogger.info('bff route request', {
    requestId: context.requestId,
    routeId: 'route:showcase',
    span: 'route_handler',
    fields: { method: request.method, path, locale, actorType: hasSessionCookie ? 'user' : 'guest', hasSessionCookie },
  });

  try {
    const data = await getShowcaseListService(context);
    // 公开只读端点：显式 opt-in 短缓存（默认 no-store，此处主动放宽）。
    const response = createBffSuccessResponse(data, context, {
      cacheControl: 'public, s-maxage=60, stale-while-revalidate=120',
    });
    serverLogger.info('bff route response', {
      requestId: context.requestId,
      routeId: 'route:showcase',
      span: 'route_handler',
      fields: { status: response.status, durationMs: Date.now() - startedAt, cacheControl: 'public, s-maxage=60' },
    });
    return response;
  } catch (error) {
    const status = error instanceof ShowcaseGatewayError ? error.status : 500;
    serverLogger[status >= 500 ? 'error' : 'warn']('bff route response', {
      requestId: context.requestId,
      routeId: 'route:showcase',
      span: 'route_handler',
      fields: {
        status,
        durationMs: Date.now() - startedAt,
        errorKind: error instanceof ShowcaseGatewayError ? error.code : 'unexpected',
        message: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof ShowcaseGatewayError) {
      return createBffErrorResponse(error.code, error.codeMsg, context, error.status);
    }

    return createBffErrorResponse('internal_error', 'Unexpected error.', context, 500);
  }
}
