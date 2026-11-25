import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import '@domain/i18n';
import { AppProviders } from '@components/providers/app-providers';

/**
 * 根布局：只装配 Provider、StatusBar 与路由栈，不写业务逻辑。
 *
 * @returns 布局节点。
 */
export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <AppProviders>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ title: t('app.title') }} />
      </Stack>
    </AppProviders>
  );
}
