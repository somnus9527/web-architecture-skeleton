import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PaperThemeProvider } from '@components/providers/paper-theme-provider';
import { ThemeProvider } from '@theme/theme-provider';

/**
 * 测试环境固定安全区，避免依赖设备。
 */
const TEST_SAFE_AREA_METRICS = {
  frame: { height: 0, width: 0, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

/**
 * 创建测试用 QueryClient；关闭重试并把 gcTime 归零，避免残留定时器。
 *
 * @returns 测试 QueryClient。
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
      mutations: { retry: 0 },
    },
  });
}

interface ITestProvidersProps {
  /** 被渲染的节点。 */
  children: ReactNode;
}

/**
 * 组件测试统一 Provider 组合：Query → SafeArea → Theme → Paper。
 *
 * @param props - 子节点。
 * @returns Provider 组合。
 */
export function TestProviders({ children }: ITestProvidersProps) {
  const [queryClient] = useState(createTestQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ThemeProvider>
          <PaperThemeProvider>{children}</PaperThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
