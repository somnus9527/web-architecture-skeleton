import { App as AntdApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/shared/components/providers/error-boundary';
import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { appEnv } from '@/shared/config/app-env';
import { antdTheme } from '@/shared/theme/antd-theme';

interface IAppProvidersProps {
  children: ReactNode;
}

/**
 * 装配 antd 主题、错误边界和生产版本观察器。
 *
 * @param props - 应用子树。
 * @returns 已装配基础运行时的应用节点。
 */
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <ErrorBoundary>{children}</ErrorBoundary>
        {import.meta.env.PROD ? <FrontendVersionWatcher currentReleaseId={appEnv.deploymentVersion} /> : null}
      </AntdApp>
    </ConfigProvider>
  );
}
