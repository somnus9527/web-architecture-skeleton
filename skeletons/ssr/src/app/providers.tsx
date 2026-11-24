'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';

import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { theme } from '@/shared/ui/theme';

/**
 * 应用级 Provider 入参。
 */
interface IAppProvidersProps {
  /**
   * production 构建固化的 release id；development 不传入，因此不挂载版本观察器。
   */
  currentReleaseId?: string;
  /**
   * 全站路由内容。
   */
  children: ReactNode;
}

/**
 * 应用级 Provider 装配点（MUI SSR）。装配顺序：
 * Emotion 缓存(AppRouterCacheProvider, 开启 CSS layer) → ThemeProvider(挂一次) → CssBaseline。
 * provider 入口是 Client Component，但不读取任何 secret / cookie。
 *
 * @param props - 全站内容与 production 构建的 release id。
 * @returns MUI Provider 与可选的全局发版版本观察器。
 */
export function AppProviders({ children, currentReleaseId }: IAppProvidersProps) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {currentReleaseId ? <FrontendVersionWatcher currentReleaseId={currentReleaseId} /> : null}
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
