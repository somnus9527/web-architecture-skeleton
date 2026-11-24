import { RouterProvider } from 'react-router';

import { router } from './routes';

/**
 * 单应用路由出口，使用 history 模式并通过集中路由配置加载页面。
 *
 * @returns React Router provider 节点。
 */
export function AppRouter() {
  return <RouterProvider router={router} />;
}
