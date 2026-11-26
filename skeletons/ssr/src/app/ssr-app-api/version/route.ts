import 'server-only';

import { getDeploymentVersion } from '@/shared/config/deployment-version';

/**
 * 发布版本端点。只返回非敏感的运行版本信息，并始终禁止缓存。
 *
 * @returns 当前应用版本摘要。
 */
export function GET(): Response {
  return Response.json(
    { releaseId: getDeploymentVersion() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'CDN-Cache-Control': 'no-store',
        'Surrogate-Control': 'no-store',
      },
    },
  );
}

export const dynamic = 'force-dynamic';
