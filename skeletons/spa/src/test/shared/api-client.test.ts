import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/shared/store/session-store';
import { apiRequest } from '@/shared/tools/api-client';

/**
 * 构造返回固定状态码与 envelope 的 fetch mock。
 *
 * @param status - HTTP 状态码。
 * @param payload - 响应 JSON。
 * @returns fetch mock。
 */
function createFetchMock(status: number, payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

describe('api client session wiring', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  it('should send same-origin cookies and never inject an authorization header', async () => {
    useSessionStore.getState().startSession({ id: 'U-1001', displayName: 'Demo Operator' });
    const fetchMock = createFetchMock(200, { data: { ok: true }, code: '200', codeMsg: null });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/probe');

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(requestInit?.headers);

    expect(requestInit?.credentials).toBe('same-origin');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('should clear the in-memory session when the backend rejects the cookie', async () => {
    useSessionStore.getState().startSession({ id: 'U-1001', displayName: 'Demo Operator' });
    const fetchMock = createFetchMock(401, { data: null, code: 'auth.session_expired', codeMsg: 'expired' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/probe')).rejects.toThrow();

    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(useSessionStore.getState().user).toBeNull();
  });
});
