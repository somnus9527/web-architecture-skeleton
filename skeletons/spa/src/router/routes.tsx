import { createBrowserRouter, Navigate } from 'react-router';

import { AppShell } from '@/app/shell/app-shell';
import { RequireSession } from '@/router/require-session';
import { ROUTE_PATHS } from '@/router/route-paths';
import { RouteFallback } from '@/shared/components/router/route-fallback';
import { appEnv } from '@/shared/config/app-env';

/**
 * history 模式路由配置。登录页之外的页面都要求存在会话，页面均通过 lazy route module 异步加载。
 */
export const router = createBrowserRouter(
  [
    {
      path: ROUTE_PATHS.login,
      lazy: () => import('@/features/auth/pages/login-page'),
    },
    {
      element: <RequireSession />,
      children: [
        {
          element: <AppShell />,
          children: [
            {
              path: ROUTE_PATHS.root,
              element: <Navigate to={ROUTE_PATHS.workspace} replace />,
            },
            {
              path: ROUTE_PATHS.workspace,
              lazy: () => import('@/features/workspace/pages/dashboard-page'),
            },
            {
              path: ROUTE_PATHS.orders,
              lazy: () => import('@/features/workspace/pages/orders-placeholder-page'),
            },
            {
              path: ROUTE_PATHS.inventory,
              lazy: () => import('@/features/workspace/pages/inventory-placeholder-page'),
            },
            {
              path: ROUTE_PATHS.settings,
              lazy: () => import('@/features/workspace/pages/settings-placeholder-page'),
            },
          ],
        },
      ],
    },
    {
      path: '*',
      element: <RouteFallback titleKey="routes.not_found.title" descriptionKey="routes.not_found.description" />,
    },
  ],
  {
    basename: appEnv.basePath,
  },
);
