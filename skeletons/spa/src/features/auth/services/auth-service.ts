import { apiRequest } from '@/shared/tools/api-client';

import type { ILoginRequest, ILoginResult, ILogoutResult } from '@/features/auth/types/auth.types';

/**
 * 使用业务账号登录并获取会话 token。
 *
 * @param request - 登录请求体。
 * @returns 登录后的 token 与最小用户标识。
 */
export async function login(request: ILoginRequest): Promise<ILoginResult> {
  const response = await apiRequest<ILoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return response.data;
}

/**
 * 注销当前会话；必须先由服务端撤销，本地清理由调用方在完成后执行。
 *
 * @returns 服务端撤销结果。
 */
export async function logout(): Promise<ILogoutResult> {
  const response = await apiRequest<ILogoutResult>('/auth/logout', {
    method: 'POST',
  });

  return response.data;
}
