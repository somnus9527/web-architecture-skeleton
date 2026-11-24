import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShowcaseGatewayError } from '@/bff/gateway/showcase-gateway';
import type * as ShowcaseGatewayModule from '@/bff/gateway/showcase-gateway';
import { getShowcaseListForHomeService } from '@/bff/services/showcase-service';
import type { IRequestContext } from '@/bff/shared/request-context';

const fetchShowcaseListMock = vi.hoisted(() => vi.fn());

vi.mock('@/bff/shared/logger/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/bff/gateway/showcase-gateway', async (importOriginal) => {
  const original = await importOriginal<typeof ShowcaseGatewayModule>();

  return {
    ...original,
    fetchShowcaseList: fetchShowcaseListMock,
  };
});

const context: IRequestContext = {
  requestId: 'test-request-id',
  locale: 'zh-CN',
};

describe('getShowcaseListForHomeService', () => {
  beforeEach(() => {
    fetchShowcaseListMock.mockReset();
  });

  it('showcase 上游契约异常时返回首页空态', async () => {
    fetchShowcaseListMock.mockRejectedValue(
      new ShowcaseGatewayError(502, 'malformed_wrapper', 'Showcase response wrapper is malformed.'),
    );

    await expect(getShowcaseListForHomeService(context)).resolves.toEqual({
      items: [],
      total: 0,
      isEmpty: true,
    });
  });
});
