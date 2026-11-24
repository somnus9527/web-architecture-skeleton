/**
 * 健康检查端点。轻量、no-store、不依赖慢后端。
 *
 * @returns 服务存活状态。
 */
export function GET(): Response {
  return Response.json({ status: 'ok', service: 'ssr-app-web' }, { headers: { 'Cache-Control': 'no-store' } });
}
