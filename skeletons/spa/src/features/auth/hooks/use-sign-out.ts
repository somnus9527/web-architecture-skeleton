import { useState } from 'react';
import { useNavigate } from 'react-router';

import { LOG_EVENTS } from '@/shared/observability/events';
import { logout } from '@/features/auth/services/auth-service';
import { ROUTE_PATHS } from '@/router/route-paths';
import { logger } from '@/shared/services/logger';
import { useSessionStore } from '@/shared/store/session-store';

/**
 * 登出动作状态与事件。
 */
export interface IUseSignOutResult {
  /**
   * 是否正在等待服务端撤销。
   */
  isSigningOut: boolean;
  /**
   * 触发登出。
   */
  signOut: () => void;
}

/**
 * 先请求服务端撤销会话，再清理本地会话态并回到登录页。
 *
 * @returns 登出页面需要的状态与事件。
 */
export function useSignOut(): IUseSignOutResult {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const [isSigningOut, setIsSigningOut] = useState(false);

  /**
   * 执行服务端撤销和本地清理；撤销失败时仍清理本地态，由后续 401 兜底。
   */
  async function signOutSession(): Promise<void> {
    try {
      await logout();
    } catch (error) {
      logger.error(LOG_EVENTS.AUTH_LOGOUT_FAILED, { error });
    } finally {
      clearSession();
      setIsSigningOut(false);
      navigate(ROUTE_PATHS.login, { replace: true });
    }
  }

  return {
    isSigningOut,
    signOut: () => {
      setIsSigningOut(true);
      void signOutSession();
    },
  };
}
