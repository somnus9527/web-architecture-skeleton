import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import { paperTheme } from '@/theme/paper-theme';

import type { PropsWithChildren } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * 根 Provider 组合：安全区、Query、Paper 主题与状态栏。
 *
 * @param props - 子节点。
 * @returns Provider 组合。
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style="auto" />
          {children}
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
