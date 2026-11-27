import { App as AntdApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/shared/components/providers/error-boundary';
import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { appEnv } from '@/shared/config/app-env';
import { buildAntdTheme } from '@/shared/theme/antd-theme';
import { useThemeMode } from '@/shared/theme/theme-mode-context';
import { ThemeModeProvider } from '@/shared/theme/theme-mode-provider';

interface IAppProvidersProps {
  children: ReactNode;
}

/**
 * 装配主题模式、antd 主题、错误边界和生产版本观察器。
 *
 * @param props - 应用子树。
 * @returns 已装配基础运行时的应用节点。
 */
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <ThemeModeProvider>
      <ThemedApp>{children}</ThemedApp>
    </ThemeModeProvider>
  );
}

/**
 * 跟随当前主题的 antd 装配层；放在 ThemeModeProvider 内部才能读到解析后的主题。
 *
 * @param props - 应用子树。
 * @returns antd Provider 节点。
 */
function ThemedApp({ children }: IAppProvidersProps) {
  const { resolved } = useThemeMode();

  return (
    <ConfigProvider theme={buildAntdTheme(resolved)}>
      <AntdApp>
        <ErrorBoundary>{children}</ErrorBoundary>
        {import.meta.env.PROD ? <FrontendVersionWatcher currentReleaseId={appEnv.deploymentVersion} /> : null}
      </AntdApp>
    </ConfigProvider>
  );
}
