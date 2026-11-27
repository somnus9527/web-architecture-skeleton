// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@/shared/errors/codes';
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
    const response = createBffErrorResponse(ERROR_CODES.BFF_INTERNAL_ERROR.code, 'failed', CONTEXT, 500);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('BFF trace headers', () => {
  it('回填后端 TLog traceId 到响应头', () => {
    const response = createBffSuccessResponse({ ok: true }, { ...CONTEXT, tlogTraceId: 'tlog-abc' });

    expect(response.headers.get('X-Request-Id')).toBe('req-test');
    expect(response.headers.get('X-TLog-Trace-Id')).toBe('tlog-abc');
  });

  it('没有 tlogTraceId 时不下发空头', () => {
    const response = createBffErrorResponse(ERROR_CODES.BFF_INTERNAL_ERROR.code, 'failed', CONTEXT, 500);

    expect(response.headers.get('X-Request-Id')).toBe('req-test');
    expect(response.headers.get('X-TLog-Trace-Id')).toBeNull();
  });
});
