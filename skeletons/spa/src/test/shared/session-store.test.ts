import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_STORAGE_KEY, getSessionToken, useSessionStore } from '@/shared/store/session-store';

/**
 * 写入一次测试会话。
 */
function startTestSession(): void {
  useSessionStore.getState().startSession({
    token: 'token-1',
    user: { id: 'U-1001', displayName: 'Demo Operator' },
  });
}

describe('session store', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.getState().clearSession();
  });

  it('should expose the token to non-react consumers after login', () => {
    startTestSession();

    expect(getSessionToken()).toBe('token-1');
  });

  it('should persist the versioned session envelope with the minimal user identity', () => {
    startTestSession();

    const persisted = localStorage.getItem(SESSION_STORAGE_KEY);

    expect(JSON.parse(persisted ?? '{}')).toEqual({
      state: {
        token: 'token-1',
        user: { id: 'U-1001', displayName: 'Demo Operator' },
      },
      version: 1,
    });
  });

  it('should clear both memory and persisted state on sign out', () => {
    startTestSession();
    useSessionStore.getState().clearSession();

    expect(getSessionToken()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('"token":null');
  });
});
