import { AppProviders } from '@/app/providers/app-providers';
import { AppRouter } from '@/router/app-router';

/**
 * SPA 应用入口，统一装配应用级 Provider 与路由出口。
 */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
