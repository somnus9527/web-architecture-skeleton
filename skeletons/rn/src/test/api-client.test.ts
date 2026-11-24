import { ApiError, getJson } from '@/api/client';

describe('api client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  /**
   * 构造一个返回指定 envelope 的 fetch 假实现。
   *
   * @param body - 响应体。
   * @returns fetch mock。
   */
  function mockFetch(body: unknown): jest.Mock {
    const mock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    return mock;
  }

  it('should unwrap the data field of a successful envelope', async () => {
    mockFetch({ code: '200', data: { title: '工作台' } });

    await expect(getJson<{ title: string }>('/home/summary')).resolves.toEqual({ title: '工作台' });
  });

  it('should raise an ApiError when the business code is not 200', async () => {
    mockFetch({ code: '500', codeMsg: 'boom' });

    await expect(getJson('/home/summary')).rejects.toBeInstanceOf(ApiError);
  });

  it('should raise an ApiError when the http status is not ok', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(getJson('/home/summary')).rejects.toMatchObject({ code: 'http_502' });
  });
});
