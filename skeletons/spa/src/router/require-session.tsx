import { Navigate, Outlet, useLocation } from 'react-router';

import { ROUTE_PATHS } from '@/router/route-paths';
import { useSessionStore } from '@/shared/store/session-store';

/**
 * 会话守卫；没有 token 时把用户送回登录页。
 *
 * 路由守卫只是 UX，真实鉴权与越权校验仍由后端完成。
 *
 * @returns 受保护路由出口或登录页跳转。
 */
export function RequireSession() {
  const token = useSessionStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    const redirectTarget = `${location.pathname}${location.search}`;

    return <Navigate to={`${ROUTE_PATHS.login}?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return <Outlet />;
}
