import { act, render } from '@testing-library/react';

import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';

describe('FrontendVersionWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Cache-Control': 'no-store' }),
        json: async () => ({ releaseId: 'release-next' }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it('checks version metadata after the configured interval', async () => {
    render(<FrontendVersionWatcher currentReleaseId="release-current" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/version\.json\?_=\d+$/u),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
      }),
    );
  });
});
