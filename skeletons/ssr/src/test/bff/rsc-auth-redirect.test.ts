// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BffHttpClientError } from '@/bff/shared/http-client';
import { redirectToLoginOnBffAuthError, rethrowIfBffAuthError } from '@/bff/shared/rsc-auth-redirect';
import { BffAuthError } from '@/bff/transform/session-auth-transform';

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('rsc auth redirect helper', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects to login when a BFF auth error reaches an RSC read', async () => {
    await expect(
      redirectToLoginOnBffAuthError(Promise.reject(new BffAuthError(401, 'auth.session_expired', 'expired'))),
    ).rejects.toThrow('NEXT_REDIRECT:/login?notice=expired');

    expect(redirectMock).toHaveBeenCalledWith('/login?notice=expired');
  });

  it('keeps non-auth BFF errors for the page error boundary', async () => {
    const error = new BffHttpClientError({
      code: 'UPSTREAM_FAILED',
      codeMsg: 'Upstream failed.',
      endpointId: 'test.endpoint',
      kind: 'http',
      operationId: 'testOperation',
      requestId: 'req-test',
      status: 502,
    });

    await expect(redirectToLoginOnBffAuthError(Promise.reject(error))).rejects.toBe(error);
  });

  it('supports allSettled fallback flows without swallowing auth errors', () => {
    expect(() => rethrowIfBffAuthError(new BffAuthError(401, 'auth.session_expired', 'expired'))).toThrow(
      'NEXT_REDIRECT:/login?notice=expired',
    );
  });
});
