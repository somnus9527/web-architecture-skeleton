import { fetchHomeSummary } from '@api/endpoints/home';
import { ApiError } from '@api/errors';
import type { IHomeSummary } from '@domain/contracts/home';

const BASE_URL = 'https://test.api';

interface IMockResponseInit {
  /** 响应体文本。 */
  text: string;
  /** HTTP 状态码，默认 200。 */
  status?: number;
}

/**
 * 构造一个可断言的 fetch 假实现。
 *
 * @param init - 响应体与状态码。
 * @returns fetch 假实现。
 */
function createFetchMock(init: IMockResponseInit) {
  const status = init.status ?? 200;

  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => init.text,
  });
}

/**
 * 把 jest mock 收窄成 client 接受的 fetch 实现。
 *
 * @param mock - jest mock。
 * @returns 可注入的 fetch 实现。
 */
function asFetchImpl(mock: jest.Mock) {
  return mock as unknown as (
    url: string,
    init: { headers: Record<string, string>; method: string },
  ) => Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
  }>;
}

describe('fetchHomeSummary', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should request the summary path and unwrap the envelope', async () => {
    const summary: IHomeSummary = { items: [{ id: '1', status: 'pending', title: '待处理订单' }], title: '工作台' };
    const fetchMock = createFetchMock({ text: JSON.stringify({ code: '200', data: summary }) });

    await expect(fetchHomeSummary({ baseUrl: BASE_URL, fetchImpl: asFetchImpl(fetchMock) })).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/home/summary`, expect.objectContaining({ method: 'GET' }));
  });

  it('should raise ApiError when the business code is not the success code', async () => {
    const envelope = { code: '500', codeMsg: 'boom', data: null };
    const fetchMock = createFetchMock({ text: JSON.stringify(envelope) });

    const error = await fetchHomeSummary({ baseUrl: BASE_URL, fetchImpl: asFetchImpl(fetchMock) }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ data: envelope, message: 'boom', status: 200 });
  });

  it('should keep the http status on transport errors', async () => {
    const fetchMock = createFetchMock({ status: 502, text: JSON.stringify({ message: 'bad gateway' }) });

    const error = await fetchHomeSummary({ baseUrl: BASE_URL, fetchImpl: asFetchImpl(fetchMock) }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'bad gateway', status: 502 });
  });
});
