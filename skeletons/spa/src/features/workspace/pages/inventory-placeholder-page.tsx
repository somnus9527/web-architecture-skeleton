import { RouteFallback } from '@/shared/components/router/route-fallback';

/**
 * 库存路由占位页面。
 *
 * @returns 库存占位页节点。
 */
export function Component() {
  return <RouteFallback titleKey="routes.inventory.title" descriptionKey="routes.inventory.description" />;
}
