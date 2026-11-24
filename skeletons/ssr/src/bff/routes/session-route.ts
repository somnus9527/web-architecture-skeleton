import 'server-only';

import { BffAuthError, buildBackendAuthHeaders } from '../transform/session-auth-transform';

import { createBffErrorResponse, createBffSuccessResponse } from '@/bff/shared/http-response';
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

  try {
    const auth = buildBackendAuthHeaders(request.headers, config.sessionCookieName);
    const data: ISessionViewModel = { isAuthenticated: true, userType: auth.xUserType };
    return createBffSuccessResponse(data, context);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return createBffErrorResponse(error.code, error.codeMsg, context, error.status);
    }

    return createBffErrorResponse('internal_error', 'Unexpected error.', context, 500);
  }
}
