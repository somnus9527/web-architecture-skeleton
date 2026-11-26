import { apiRequest } from '@/shared/tools/api-client';

import type { ILoginRequest, ILoginResult, ILogoutResult, ISessionResult } from '@/features/auth/types/auth.types';

/**
 * 使用业务账号登录；服务端通过 Set-Cookie 写入 HttpOnly 会话 cookie。
 *
 * @param request - 登录请求体。
 * @returns 登录后的最小用户标识，不含 token。
 */
export async function login(request: ILoginRequest): Promise<ILoginResult> {
  const response = await apiRequest<ILoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return response.data;
}

/**
 * 查询当前 cookie 对应的服务端会话，用于刷新后水合登录态。
 *
 * @returns 服务端确认的会话状态。
 */
export async function getSession(): Promise<ISessionResult> {
  const response = await apiRequest<ISessionResult>('/auth/session');

  return response.data;
}

/**
 * 注销当前会话；服务端撤销并清除 HttpOnly cookie。
 *
 * @returns 服务端撤销结果。
 */
export async function logout(): Promise<ILogoutResult> {
  const response = await apiRequest<ILogoutResult>('/auth/logout', {
    method: 'POST',
  });

  return response.data;
}
