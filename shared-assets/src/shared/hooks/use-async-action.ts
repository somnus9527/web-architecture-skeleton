import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 异步动作 hook 的可选项。
 */
export interface IUseAsyncActionOptions<TArgs extends unknown[], TResult> {
  /**
   * 按参数派生并发键；并发动作中只展示最后一个键的 pending。
   */
  keyOf?: (...args: TArgs) => string;
  /**
   * 把错误转成用户可见文案。
   */
  formatError?: (error: unknown) => string;
  /**
   * 成功回调。
   */
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  /**
   * 失败回调。
   */
  onError?: (error: unknown) => void;
}

/**
 * 异步动作 hook 的返回值。
 */
export interface IUseAsyncActionResult<TArgs extends unknown[], TResult> {
  /**
   * 触发动作。
   */
  run: (...args: TArgs) => Promise<TResult | null>;
  /**
   * 是否有动作在执行。
   */
  pending: boolean;
  /**
   * 最近一次动作的并发键。
   */
  pendingKey: string | null;
  /**
   * 最近一次错误对象。
   */
  error: unknown;
  /**
   * 由 formatError 转换的错误文案。
   */
  errorMessage: string | null;
  /**
   * 清空错误态。
   */
  reset: () => void;
}

/**
 * 管理一次写操作的 pending、错误与并发键，用于提交、删除、状态推进等动作。
 *
 * 与 `useRequest` 的分工：读取用 `useRequest`，写入用 `useAsyncAction`。两者都不处理文案与日志，
 * 由调用方注入 `formatError` 与回调。
 *
 * @param action - 稳定引用的动作函数。
 * @param options - 可选项。
 * @returns 动作状态与触发函数。
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: IUseAsyncActionOptions<TArgs, TResult> = {},
): IUseAsyncActionResult<TArgs, TResult> {
  const { keyOf, formatError, onSuccess, onError } = options;
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const actionRef = useRef(action);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 每次渲染后同步最新 action，避免把闭包变化当成并发键变化。
  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setPendingCount((current) => current + 1);
      setPendingKey(keyOf ? keyOf(...args) : null);
      setErrorMessage(null);

      try {
        const result = await actionRef.current(...args);
        if (!mountedRef.current) {
          return null;
        }

        setError(null);
        onSuccess?.(result, ...args);
        return result;
      } catch (caught) {
        if (!mountedRef.current) {
          return null;
        }

        setError(caught);
        setErrorMessage(formatError ? formatError(caught) : null);
        onError?.(caught);
        return null;
      } finally {
        if (mountedRef.current) {
          setPendingCount((current) => Math.max(0, current - 1));
        }
      }
    },
    [formatError, keyOf, onError, onSuccess],
  );

  const reset = useCallback((): void => {
    setError(null);
    setErrorMessage(null);
  }, []);

  return { run, pending: pendingCount > 0, pendingKey, error, errorMessage, reset };
}
