import { RouteFallback } from '@/shared/components/router/route-fallback';

/**
 * 设置路由占位页面。
 *
 * @returns 设置占位页节点。
 */
export function Component() {
  return <RouteFallback titleKey="routes.settings.title" descriptionKey="routes.settings.description" />;
}
