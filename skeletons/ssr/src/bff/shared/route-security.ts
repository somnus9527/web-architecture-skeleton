import 'server-only';

import type { IServerConfig } from '@/bff/shared/server-config';

export class BffCsrfError extends Error {
  readonly code = 'csrf_forbidden';
  readonly codeMsg = 'Request origin is not allowed.';
  readonly status = 403;

  constructor() {
    super('Request origin is not allowed.');
    this.name = 'BffCsrfError';
  }
}

function resolveHeaderOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (origin) {
    return origin;
  }

  const referer = request.headers.get('referer');
  if (!referer) {
    return null;
  }

  try {
    const refererUrl = new URL(referer);
    return refererUrl.origin;
  } catch {
    return null;
  }
}

export function assertSameOriginPostRequest(request: Request, config: IServerConfig): void {
  if (!config.isCsrfEnabled) {
    return;
  }

  const requestOrigin = resolveHeaderOrigin(request);
  if (requestOrigin !== config.appOrigin) {
    throw new BffCsrfError();
  }
}

function assertSafeCookieValue(value: string): void {
  if (/[\r\n;]/.test(value)) {
    throw new Error('Cookie value contains illegal characters.');
  }
}

export function buildPortalSessionSetCookie(token: string, config: IServerConfig): string {
  assertSafeCookieValue(token);

  return [
    `${config.sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    config.isSessionCookieSecure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function buildPortalSessionClearCookie(config: IServerConfig): string {
  return [
    `${config.sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    config.isSessionCookieSecure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function withSetCookieHeader(response: Response, cookieValue: string): Response {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookieValue);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
