import { LogOut } from 'lucide-react';
import { Outlet } from 'react-router';

import { useSignOut } from '@/features/auth/hooks/use-sign-out';
import { t } from '@/locale';
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
    <div className="min-h-screen bg-[#f6f7f9]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-slate-950">{t('app.title')}</p>
        <div className="flex items-center gap-3">
          {/* 顶栏只展示最小用户标识，权限与敏感资料不在前端会话里保存。 */}
          <span className="text-xs text-slate-500">{t('auth.session.signed_in_as')}</span>
          <span className="text-xs font-medium text-slate-900">{user?.displayName ?? '-'}</span>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={signOut.isSigningOut}
            onClick={signOut.signOut}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signOut.isSigningOut ? t('auth.logout.pending') : t('auth.logout.action')}
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
