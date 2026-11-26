// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createBffErrorResponse, createBffSuccessResponse } from '@/bff/shared/http-response';

const CONTEXT = { requestId: 'req-test', locale: 'en-US' };

describe('BFF response cache policy', () => {
  it('defaults user-scoped success responses to no-store', () => {
    const response = createBffSuccessResponse({ ok: true }, CONTEXT);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('allows public endpoints to explicitly opt in to caching', () => {
    const response = createBffSuccessResponse({ ok: true }, CONTEXT, { cacheControl: 'public, s-maxage=60' });

    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60');
  });

  it('always keeps error responses no-store', () => {
    const response = createBffErrorResponse('internal_error', 'failed', CONTEXT, 500);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
