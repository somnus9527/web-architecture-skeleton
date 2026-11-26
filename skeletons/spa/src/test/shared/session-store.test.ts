import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/shared/store/session-store';

const TEST_USER = { id: 'U-1001', displayName: 'Demo Operator' };

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
  });

  it('should start from an unknown state', () => {
    useSessionStore.setState({ status: 'unknown', user: null });

    expect(useSessionStore.getState().status).toBe('unknown');
  });

  it('should become authenticated with the minimal user identity after login', () => {
    useSessionStore.getState().startSession(TEST_USER);

    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().user).toEqual(TEST_USER);
  });

  it('should clear memory state on sign out', () => {
    useSessionStore.getState().startSession(TEST_USER);
    useSessionStore.getState().clearSession();

    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('should not persist session data to browser storage', () => {
    useSessionStore.getState().startSession(TEST_USER);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
