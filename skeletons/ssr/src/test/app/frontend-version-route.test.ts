import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/deployment-version', () => ({
  getDeploymentVersion: vi.fn(() => 'release-next'),
}));

import { GET } from '@/app/ssr-app-api/version/route';

describe('frontend version route', () => {
  it('returns the active release id without allowing caches', async () => {
    const response = GET();

    await expect(response.json()).resolves.toEqual({ releaseId: 'release-next' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(response.headers.get('Surrogate-Control')).toBe('no-store');
  });
});
