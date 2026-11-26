import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { getSession } from '@/features/auth/services/auth-service';
import { t } from '@/locale';
import { ROUTE_PATHS } from '@/router/route-paths';
import { useSessionStore } from '@/shared/store/session-store';

/**
 * 会话守卫；刷新后先用 /auth/session 水合 cookie 会话，再决定放行或回登录页。
 *
 * 路由守卫只是 UX，真实鉴权与越权校验仍由后端完成。
 *
 * @returns 受保护路由出口、会话确认中的占位或登录页跳转。
 */
export function RequireSession() {
  const status = useSessionStore((state) => state.status);
  const startSession = useSessionStore((state) => state.startSession);
  const markAnonymous = useSessionStore((state) => state.markAnonymous);
  const location = useLocation();

  useEffect(() => {
    if (status !== 'unknown') {
      return undefined;
    }

    let active = true;

    void getSession()
      .then((session) => {
        if (!active) {
          return;
        }

        if (session.isAuthenticated && session.user) {
          startSession(session.user);
        } else {
          markAnonymous();
        }
      })
      .catch(() => {
        if (active) {
          markAnonymous();
        }
      });

    return () => {
      active = false;
    };
  }, [markAnonymous, startSession, status]);

  if (status === 'unknown') {
    return <main className="page-center page-center--muted">{t('common.loading')}</main>;
  }

  if (status === 'anonymous') {
    const redirectTarget = `${location.pathname}${location.search}`;

    return <Navigate to={`${ROUTE_PATHS.login}?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return <Outlet />;
}
