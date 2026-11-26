'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { antdTheme } from '@/shared/theme/antd-theme';

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
 * 应用级 Provider 装配点（antd SSR）。装配顺序：
 * AntdRegistry(首屏样式抽取) → ConfigProvider(主题) → App(message/notification 上下文)。
 * provider 入口是 Client Component，但不读取任何 secret / cookie。
 *
 * @param props - 全站内容与 production 构建的 release id。
 * @returns antd Provider 与可选的全局发版版本观察器。
 */
export function AppProviders({ children, currentReleaseId }: IAppProvidersProps) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          {currentReleaseId ? <FrontendVersionWatcher currentReleaseId={currentReleaseId} /> : null}
          {children}
        </AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
