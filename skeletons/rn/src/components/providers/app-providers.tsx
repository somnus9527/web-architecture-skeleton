import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@api/errors';
import { NetworkBridge } from '@components/providers/network-bridge';
import { PaperThemeProvider } from '@components/providers/paper-theme-provider';
import { QueryFocusBridge } from '@components/providers/query-focus-bridge';
import { QueryOnlineBridge } from '@components/providers/query-online-bridge';
import { ThemeProvider } from '@theme/theme-provider';

/**
 * 全局 QueryClient 默认配置：缓存时长、错误重试策略与重连刷新。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // 4xx 客户端错误不重试；5xx 与网络错误最多重试 2 次。
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

/**
 * Jest / 无原生窗口环境下 initialWindowMetrics 可能为空。
 */
const safeAreaInitialMetrics = {
  frame: { height: 0, width: 0, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

interface IAppProvidersProps {
  /** 子树。 */
  children: ReactNode;
}

/**
 * 根 Provider 组合，按 startup 规则的层级表嵌套：
 * 数据层 → 平台 / 安全区 → 主题 → UI 库 → 桥接。
 *
 * @param props - 子树。
 * @returns Provider 组合。
 */
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
        <ThemeProvider>
          <PaperThemeProvider>
            <QueryFocusBridge />
            <NetworkBridge />
            <QueryOnlineBridge />
            {children}
          </PaperThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
