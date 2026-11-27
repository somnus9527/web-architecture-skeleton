import 'server-only';

import { BffAuthError, buildBackendAuthHeaders } from '../transform/session-auth-transform';

import { LOG_EVENTS } from '@/shared/observability/events';
import { ERROR_CODES } from '@/shared/errors/codes';
import { createBffErrorResponse, createBffSuccessResponse } from '@/bff/shared/http-response';
import { serverLogger } from '@/bff/shared/logger/server-logger';
import { createRequestContext } from '@/bff/shared/request-context';
import { getServerConfig } from '@/bff/shared/server-config';

/**
 * 会话视图模型：仅暴露鉴权态与用户类型，绝不回传 token。
 */
export interface ISessionViewModel {
  isAuthenticated: boolean;
  userType: string;
}

/**
 * 会话 Route Handler facade：校验同源会话 cookie，返回鉴权态。
 *
 * @param request - 进入的 HTTP 请求。
 * @returns 统一信封 JSON 响应（no-store）。
 */
export async function handleGetSessionRoute(request: Request, locale: string): Promise<Response> {
  const context = createRequestContext(request.headers, locale);
  const config = getServerConfig();
  const startedAt = Date.now();
  const hasSessionCookie = Boolean(request.headers.get('cookie'));
  serverLogger.info(LOG_EVENTS.BFF_ROUTE_REQUEST, {
    requestId: context.requestId,
    routeId: 'route:session',
    span: 'route_handler',
    fields: { method: request.method, locale, actorType: hasSessionCookie ? 'user' : 'guest', hasSessionCookie },
  });

  try {
    const auth = buildBackendAuthHeaders(request.headers, config.sessionCookieName);
    const data: ISessionViewModel = { isAuthenticated: true, userType: auth.xUserType };
    const response = createBffSuccessResponse(data, context);
    serverLogger.info(LOG_EVENTS.BFF_ROUTE_RESPONSE, {
      requestId: context.requestId,
      routeId: 'route:session',
      span: 'route_handler',
      fields: { status: response.status, durationMs: Date.now() - startedAt, isAuthenticated: true },
    });
    return response;
  } catch (error) {
    const status = error instanceof BffAuthError ? error.status : 500;
    serverLogger[status >= 500 ? 'error' : 'warn'](LOG_EVENTS.BFF_ROUTE_RESPONSE, {
      requestId: context.requestId,
      routeId: 'route:session',
      span: 'route_handler',
      fields: {
        status,
        durationMs: Date.now() - startedAt,
        errorKind: error instanceof BffAuthError ? error.code : 'unexpected',
      },
    });
    if (error instanceof BffAuthError) {
      return createBffErrorResponse(error.code, error.codeMsg, context, error.status);
    }

    return createBffErrorResponse(ERROR_CODES.BFF_INTERNAL_ERROR.code, 'Unexpected error.', context, 500);
  }
}
