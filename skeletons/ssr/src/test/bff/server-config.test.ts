// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const COMMON_ENV = {
  LOG_LEVEL: 'info',
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  SESSION_COOKIE_NAME: 'ssr_app_auth',
};

function setServerConfigEnv(appEnv: 'dev' | 'mock', prismMockBaseUrl?: string): void {
  const appOrigin = appEnv === 'mock' ? 'http://127.0.0.1:3001' : 'https://dev.example.com';
  const backendApiBaseUrl = appEnv === 'mock' ? 'http://127.0.0.1:4011' : 'https://backend.example.com';

  Object.assign(process.env, {
    APP_ENV: appEnv,
    APP_ORIGIN: appOrigin,
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

function setProdEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    APP_ENV: 'prod',
    APP_ORIGIN: 'https://app.example.com',
    BACKEND_API_BASE_URL: 'https://api.example.com',
    CSRF_ENABLED: 'true',
    NEXT_PUBLIC_APP_ENV: 'prod',
    NEXT_PUBLIC_APP_ORIGIN: 'https://app.example.com',
    SESSION_COOKIE_SECURE: 'true',
    ...COMMON_ENV,
    ...overrides,
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.APP_ORIGIN;
  delete process.env.BACKEND_API_BASE_URL;
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

  it('requires a remote backend URL outside mock', async () => {
    setServerConfigEnv('dev');
    delete process.env.BACKEND_API_BASE_URL;

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow('BACKEND_API_BASE_URL is required outside mock.');
  });

  it('rejects prod when CSRF is disabled', async () => {
    setProdEnv({ CSRF_ENABLED: 'false' });

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow('CSRF_ENABLED must be true in prod.');
  });

  it('rejects prod when the session cookie is not secure', async () => {
    setProdEnv({ SESSION_COOKIE_SECURE: 'false' });

    const { getServerConfig } = await loadServerConfigModule();

    expect(() => getServerConfig()).toThrow('SESSION_COOKIE_SECURE must be true in prod.');
  });

  it('accepts prod when cookie and CSRF switches are secure', async () => {
    setProdEnv();

    const { getServerConfig } = await loadServerConfigModule();
    const config = getServerConfig();

    expect(config.appEnv).toBe('prod');
    expect(config.isSessionCookieSecure).toBe(true);
    expect(config.isCsrfEnabled).toBe(true);
  });
});
