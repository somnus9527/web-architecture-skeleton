import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_STORAGE_KEY, useSessionStore } from '@/shared/store/session-store';
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

/**
 * 写入一次测试会话。
 */
function startTestSession(): void {
  useSessionStore.getState().startSession({
    token: 'token-1',
    user: { id: 'U-1001', displayName: 'Demo Operator' },
  });
}

describe('api client session wiring', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  it('should inject the session token as a bearer header', async () => {
    startTestSession();
    const fetchMock = createFetchMock(200, { data: { ok: true }, code: '200', codeMsg: null });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/probe');

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(requestInit?.headers);

    expect(headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('should clear the persisted session when the backend rejects the token', async () => {
    startTestSession();
    const fetchMock = createFetchMock(401, { data: null, code: 'auth.session_expired', codeMsg: 'expired' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/probe')).rejects.toThrow();

    expect(useSessionStore.getState().token).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('"token":null');
  });
});
