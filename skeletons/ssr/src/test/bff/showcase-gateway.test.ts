import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchShowcaseList } from '@/bff/gateway/showcase-gateway';
import { BffHttpClientError, requestBackend } from '@/bff/shared/http-client';
import type { IRequestContext } from '@/bff/shared/request-context';

vi.mock('@/bff/shared/http-client', async (importOriginal) => {
  const original = await importOriginal();

  return {
    ...(original as object),
    requestBackend: vi.fn(),
  };
});

const requestBackendMock = vi.mocked(requestBackend);

function createContext(requestId: string): IRequestContext {
  return { locale: 'zh-CN', requestId };
}

describe('showcase gateway', () => {
  beforeEach(() => {
    requestBackendMock.mockReset();
  });

  it('fetches showcase list through the shared http client', async () => {
    requestBackendMock.mockResolvedValueOnce({
      items: [{ category: 'demo', id: 'showcase-1', summary: 'Summary', title: 'Title', updatedAt: '2026-08-26' }],
      total: 1,
    });

    await expect(fetchShowcaseList(createContext('req-showcase-success'))).resolves.toEqual({
      items: [{ category: 'demo', id: 'showcase-1', summary: 'Summary', title: 'Title', updatedAt: '2026-08-26' }],
      total: 1,
    });
    expect(requestBackendMock).toHaveBeenCalledWith({
      cache: 'no-store',
      context: createContext('req-showcase-success'),
      endpointId: 'showcase.list',
      method: 'GET',
      operationId: 'getShowcaseList',
      path: '/showcase',
    });
  });

  it('wraps shared http client errors as showcase gateway errors', async () => {
    requestBackendMock.mockRejectedValueOnce(
      new BffHttpClientError({
        code: 'bff.timeout',
        codeMsg: 'Upstream request timed out.',
        endpointId: 'showcase.list',
        kind: 'timeout',
        operationId: 'getShowcaseList',
        requestId: 'req-showcase-timeout',
        status: 504,
      }),
    );

    await expect(fetchShowcaseList(createContext('req-showcase-timeout'))).rejects.toMatchObject({
      code: 'bff.timeout',
      name: 'ShowcaseGatewayError',
      status: 504,
    });
  });

  it('rejects malformed showcase data', async () => {
    requestBackendMock.mockResolvedValueOnce({ items: null, total: 1 });

    await expect(fetchShowcaseList(createContext('req-showcase-malformed'))).rejects.toMatchObject({
      code: 'bff.malformed_data',
      status: 502,
    });
  });
});
