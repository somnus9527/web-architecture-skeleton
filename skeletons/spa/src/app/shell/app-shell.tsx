import { Outlet } from 'react-router';

import { useSignOut } from '@/features/auth/hooks/use-sign-out';
import { t } from '@/locale';
import { Button, LogOut, ThemeToggle } from '@/shared/ui';
import { useSessionStore } from '@/shared/store/session-store';

/**
 * 受保护路由的应用外壳，提供当前登录用户与退出登录入口。
 *
 * @returns 应用外壳节点。
 */
export function AppShell() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSignOut();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <p className="app-shell__title">{t('app.title')}</p>
        <div className="app-shell__user">
          <ThemeToggle label={t('theme.toggle')} />
          {/* 顶栏只展示最小用户标识，权限与敏感资料不在前端会话里保存。 */}
          <span>{t('auth.session.signed_in_as')}</span>
          <strong>{user?.displayName ?? '-'}</strong>
          <Button
            tone="ghost"
            icon={<LogOut aria-hidden="true" />}
            disabled={signOut.isSigningOut}
            onClick={signOut.signOut}
          >
            {signOut.isSigningOut ? t('auth.logout.pending') : t('auth.logout.action')}
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
