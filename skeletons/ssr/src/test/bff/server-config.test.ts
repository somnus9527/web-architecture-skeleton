// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const COMMON_ENV = {
  LOG_LEVEL: 'info',
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  SESSION_COOKIE_NAME: 'ssr_app_auth',
};

function setServerConfigEnv(
  appEnv: 'dev' | 'mock',
  prismMockBaseUrl?: string,
  backendMode: 'bff-only' | 'next-backend' = 'bff-only',
): void {
  const appOrigin = appEnv === 'mock' ? 'http://127.0.0.1:3001' : 'https://dev.example.com';
  const backendApiBaseUrl = appEnv === 'mock' ? 'http://127.0.0.1:4011' : 'https://backend.example.com';

  Object.assign(process.env, {
    APP_ENV: appEnv,
    APP_ORIGIN: appOrigin,
    BACKEND_MODE: backendMode,
    BACKEND_API_BASE_URL: backendApiBaseUrl,
    CSRF_ENABLED: appEnv === 'mock' ? 'false' : 'true',
    NEXT_PUBLIC_APP_ENV: appEnv,
    NEXT_PUBLIC_APP_ORIGIN: appOrigin,
    SESSION_COOKIE_SECURE: appEnv === 'mock' ? 'false' : 'true',
    ...COMMON_ENV,
  });

  if (prismMockBaseUrl === undefined) {
    delete process.env.PRISM_MOCK_BASE_URL;
    return;
  }

  process.env.PRISM_MOCK_BASE_URL = prismMockBaseUrl;
}

async function loadServerConfigModule() {
  return await import('@/bff/shared/server-config');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.APP_ORIGIN;
  delete process.env.BACKEND_API_BASE_URL;
  delete process.env.BACKEND_MODE;
  delete process.env.CSRF_ENABLED;
  delete process.env.LOG_LEVEL;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  delete process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
  delete process.env.PRISM_MOCK_BASE_URL;
  delete process.env.SESSION_COOKIE_NAME;
  delete process.env.SESSION_COOKIE_SECURE;
});

describe('server config', () => {
  it('does not require PRISM_MOCK_BASE_URL in dev', async () => {
    setServerConfigEnv('dev');

    const { getServerConfig } = await loadServerConfigModule();
    const config = getServerConfig();

    expect(config.appEnv).toBe('dev');
    expect(config.prismMockBaseUrl).toBeUndefined();
  });

  it('requires PRISM_MOCK_BASE_URL in mock', async () => {
    setServerConfigEnv('mock');

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow('PRISM_MOCK_BASE_URL is required when APP_ENV is mock.');
  });

  it('accepts PRISM_MOCK_BASE_URL in mock', async () => {
    setServerConfigEnv('mock', 'http://127.0.0.1:4011');

    const { getServerConfig } = await loadServerConfigModule();
    const config = getServerConfig();

    expect(config.appEnv).toBe('mock');
    expect(config.prismMockBaseUrl).toBe('http://127.0.0.1:4011');
  });

  it('allows next-backend without a remote backend URL outside mock', async () => {
    setServerConfigEnv('dev', undefined, 'next-backend');
    delete process.env.BACKEND_API_BASE_URL;

    const { getServerConfig } = await loadServerConfigModule();
    const config = getServerConfig();

    expect(config.backendMode).toBe('next-backend');
    expect(config.backendApiBaseUrl).toBeUndefined();
  });

  it('requires a remote backend URL for bff-only outside mock', async () => {
    setServerConfigEnv('dev');
    delete process.env.BACKEND_API_BASE_URL;

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow('BACKEND_API_BASE_URL is required for bff-only outside mock.');
  });

  it('requires an explicit backend mode', async () => {
    setServerConfigEnv('dev');
    delete process.env.BACKEND_MODE;

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow(/BACKEND_MODE/u);
  });
});
