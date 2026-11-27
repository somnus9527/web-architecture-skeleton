'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { buildAntdTheme } from '@/shared/theme/antd-theme';
import type { ThemeMode } from '@/shared/theme/theme-mode';
import { useThemeMode } from '@/shared/theme/theme-mode-context';
import { ThemeModeProvider } from '@/shared/theme/theme-mode-provider';

/**
 * 应用级 Provider 入参。
 */
interface IAppProvidersProps {
  /**
   * production 构建固化的 release id；development 不传入，因此不挂载版本观察器。
   */
  currentReleaseId?: string;
  /**
   * SSR 从主题 cookie 解析出的初始模式；缺省时由客户端从 localStorage 解析。
   */
  initialThemeMode?: ThemeMode;
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
export function AppProviders({ children, currentReleaseId, initialThemeMode }: IAppProvidersProps) {
  return (
    <AntdRegistry>
      <ThemeModeProvider initialMode={initialThemeMode}>
        <ThemedApp currentReleaseId={currentReleaseId}>{children}</ThemedApp>
      </ThemeModeProvider>
    </AntdRegistry>
  );
}

/**
 * 跟随当前主题的 antd 装配层；必须在 ThemeModeProvider 内部读取解析结果。
 *
 * @param props - 全站内容与 release id。
 * @returns antd Provider 节点。
 */
function ThemedApp({ children, currentReleaseId }: Omit<IAppProvidersProps, 'initialThemeMode'>) {
  const { resolved } = useThemeMode();

  return (
    <ConfigProvider theme={buildAntdTheme(resolved)}>
      <AntdApp>
        {currentReleaseId ? <FrontendVersionWatcher currentReleaseId={currentReleaseId} /> : null}
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
