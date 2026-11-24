import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAsyncAction } from '@/shared/hooks/use-async-action';

describe('useAsyncAction', () => {
  it('should be pending while the action runs and settle afterwards', async () => {
    let resolveAction!: (value: string) => void;
    const action = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const { result } = renderHook(() => useAsyncAction(action));

    const running = result.current.run();
    await waitFor(() => {
      expect(result.current.pending).toBe(true);
    });

    resolveAction('done');
    await act(async () => {
      await running;
    });

    expect(result.current.pending).toBe(false);
  });

  it('should expose the formatted message when the action fails', async () => {
    const action = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncAction(action, { formatError: () => '提交失败' }));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.errorMessage).toBe('提交失败');
    expect(result.current.pending).toBe(false);
  });

  it('should derive a pending key from the arguments', async () => {
    let resolveAction!: (value: string) => void;
    const action = vi.fn(
      (id: string) =>
        new Promise<string>((resolve) => {
          resolveAction = () => {
            resolve(id);
          };
        }),
    );
    const { result } = renderHook(() => useAsyncAction(action, { keyOf: (id: string) => id }));

    const running = result.current.run('order-1');
    await waitFor(() => {
      expect(result.current.pendingKey).toBe('order-1');
    });

    resolveAction('ok');
    await act(async () => {
      await running;
    });

    expect(action).toHaveBeenCalledWith('order-1');
  });
});
