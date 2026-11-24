import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRequest } from '@/shared/hooks/use-request';

/**
 * 构造一个可手动结算的 promise。
 *
 * @returns 延迟结算的 promise 与结算函数。
 */
function createDeferred<TValue>(): { promise: Promise<TValue>; resolve: (value: TValue) => void } {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

describe('useRequest', () => {
  it('should expose data and stop loading after a successful read', async () => {
    const fetcher = vi.fn().mockResolvedValue({ total: 2 });
    const { result } = renderHook(() => useRequest(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ total: 2 });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should expose the formatted message when the read fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRequest(fetcher, { formatError: () => '加载失败' }));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('加载失败');
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should keep the latest result when responses arrive out of order', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useRequest(fetcher, { enabled: false }));

    await act(async () => {
      const firstRun = result.current.run();
      const secondRun = result.current.run();
      second.resolve('second');
      await secondRun;
      first.resolve('first');
      await firstRun;
    });

    expect(result.current.data).toBe('second');
  });

  it('should not update state after unmount', async () => {
    const deferred = createDeferred<string>();
    const fetcher = vi.fn().mockReturnValue(deferred.promise);
    const { result, unmount } = renderHook(() => useRequest(fetcher, { enabled: false }));

    const running = result.current.run();
    unmount();
    deferred.resolve('late');

    await expect(running).resolves.toBe('late');
  });
});
