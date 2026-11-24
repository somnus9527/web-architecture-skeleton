import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDeploymentVersion } from '@/shared/config/deployment-version';

describe('deployment version config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses a development placeholder without requiring a deployment variable', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_VERSION', '');

    expect(getDeploymentVersion()).toBe('development');
  });

  it('requires a deployment version in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_VERSION', '');

    expect(() => getDeploymentVersion()).toThrow(
      'Invalid deployment version: NEXT_PUBLIC_DEPLOYMENT_VERSION must be a non-empty string.',
    );
  });

  it('returns the production deployment version', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_VERSION', 'prod-release');

    expect(getDeploymentVersion()).toBe('prod-release');
  });
});
