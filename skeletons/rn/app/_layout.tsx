import { Stack } from 'expo-router';

import '@/domain/i18n';
import { AppProviders } from '@/components/providers/app-providers';

/**
 * 根布局：装配 Provider 与路由栈。
 *
 * @returns 布局节点。
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
      </Stack>
    </AppProviders>
  );
}
