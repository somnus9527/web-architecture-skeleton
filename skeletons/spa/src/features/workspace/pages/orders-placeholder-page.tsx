import { RouteFallback } from '@/shared/components/router/route-fallback';

/**
 * 订单路由占位页面。
 *
 * @returns 订单占位页节点。
 */
export function Component() {
  return <RouteFallback titleKey="routes.orders.title" descriptionKey="routes.orders.description" />;
}
