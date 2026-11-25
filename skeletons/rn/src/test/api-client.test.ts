import { getJson, patchJson, postJson, requestJson } from '@api/client';
import type { ApiFetch } from '@api/client';
import { ApiError } from '@api/errors';

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
function asFetch(mock: jest.Mock): ApiFetch {
  return mock as unknown as ApiFetch;
}

describe('api client', () => {
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

  it('should parse the response body without unwrapping the envelope', async () => {
    const body = { code: '200', data: { title: '工作台' } };
    const fetchMock = createFetchMock({ text: JSON.stringify(body) });

    await expect(getJson('/home/summary', { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock) })).resolves.toEqual(body);

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/home/summary`, {
      body: undefined,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'GET',
    });
  });

  it('should normalize the base url and the path separator', async () => {
    const fetchMock = createFetchMock({ text: '{}' });

    await getJson('home/summary', { baseUrl: 'https://test.api/', fetchImpl: asFetch(fetchMock) });

    expect(fetchMock).toHaveBeenCalledWith('https://test.api/home/summary', expect.anything());
  });

  it('should send a JSON body with POST and forward the auth token', async () => {
    const fetchMock = createFetchMock({ text: '{}' });

    await postJson(
      '/home/summary',
      { name: 'a' },
      {
        authToken: 'token-1',
        baseUrl: BASE_URL,
        fetchImpl: asFetch(fetchMock),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/home/summary`, {
      body: '{"name":"a"}',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });

  it('should send PATCH through patchJson', async () => {
    const fetchMock = createFetchMock({ text: '{}' });

    await patchJson('/home/summary', { name: 'b' }, { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock) });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: '{"name":"b"}', method: 'PATCH' });
  });

  it('should use the explicit method for requestJson', async () => {
    const fetchMock = createFetchMock({ text: '{}' });

    await requestJson('/home/summary', { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock), method: 'DELETE' });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('should treat an empty body as undefined', async () => {
    const fetchMock = createFetchMock({ status: 204, text: '' });

    await expect(
      getJson('/home/summary', { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock) }),
    ).resolves.toBeUndefined();
  });

  it('should raise ApiError with status and data on 4xx', async () => {
    const errorBody = { message: 'Not found' };
    const fetchMock = createFetchMock({ status: 404, text: JSON.stringify(errorBody) });

    await expect(getJson('/missing', { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock) })).rejects.toMatchObject({
      data: errorBody,
      message: 'Not found',
      status: 404,
    });
  });

  it('should keep the 5xx status and message on the ApiError', async () => {
    const fetchMock = createFetchMock({ status: 503, text: JSON.stringify({ message: 'unavailable' }) });

    const error = await getJson('/home/summary', {
      baseUrl: BASE_URL,
      fetchImpl: asFetch(fetchMock),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'unavailable', status: 503 });
  });

  it('should normalize network failures to status 0', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'));

    const error = await getJson('/home/summary', {
      baseUrl: BASE_URL,
      fetchImpl: asFetch(fetchMock),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Network error', status: 0 });
  });

  it('should raise ApiError when the body is not valid JSON', async () => {
    const fetchMock = createFetchMock({ text: '<html>oops</html>' });

    await expect(getJson('/home/summary', { baseUrl: BASE_URL, fetchImpl: asFetch(fetchMock) })).rejects.toMatchObject({
      data: { text: '<html>oops</html>' },
      status: 200,
    });
  });
});
