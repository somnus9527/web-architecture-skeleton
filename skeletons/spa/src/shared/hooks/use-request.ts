import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 请求 hook 的可选项。
 */
export interface IUseRequestOptions<TData> {
  /**
   * 为 false 时不自动发起请求，仅暴露 run。
   */
  enabled?: boolean;
  /**
   * 自动请求的依赖；变化时重新执行。
   */
  deps?: readonly unknown[];
  /**
   * 把错误转成用户可见文案；不传时 errorMessage 保持 null。
   */
  formatError?: (error: unknown) => string;
  /**
   * 成功回调；异常不得抛出，否则会打断状态收敛。
   */
  onSuccess?: (data: TData) => void;
  /**
   * 失败回调。
   */
  onError?: (error: unknown) => void;
}

/**
 * 请求 hook 的返回值。
 */
export interface IUseRequestResult<TData, TArgs extends unknown[]> {
  /**
   * 最近一次成功的数据。
   */
  data: TData | null;
  /**
   * 是否正在请求。
   */
  loading: boolean;
  /**
   * 最近一次错误对象。
   */
  error: unknown;
  /**
   * 由 formatError 转换的错误文案。
   */
  errorMessage: string | null;
  /**
   * 以显式参数发起请求。
   */
  run: (...args: TArgs) => Promise<TData | null>;
  /**
   * 以最近一次参数重新请求。
   */
  refetch: () => Promise<void>;
  /**
   * 本地更新数据，不触发请求。
   */
  mutate: (next: TData | ((current: TData | null) => TData)) => void;
  /**
   * 清空数据、错误与加载态。
   */
  reset: () => void;
}

/**
 * 统一管理一次异步读取的状态：数据、加载、错误、重试与本地更新。
 *
 * 只处理状态与生命周期，不碰 i18n 文案、日志事件名和具体 service——这些由调用方通过
 * `formatError`、`onSuccess`、`onError` 注入。
 *
 * @param fetcher - 稳定引用的请求函数（模块级函数或 useCallback）。
 * @param options - 可选项。
 * @returns 请求状态与操作。
 */
export function useRequest<TData, TArgs extends unknown[] = []>(
  fetcher: (...args: TArgs) => Promise<TData>,
  options: IUseRequestOptions<TData> = {},
): IUseRequestResult<TData, TArgs> {
  const { enabled = true, deps = [], formatError, onSuccess, onError } = options;
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const paramsRef = useRef<TArgs>([] as unknown as TArgs);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 每次渲染后同步最新 fetcher，保证 run 取到调用方的当前闭包而不触发额外请求。
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = useCallback(
    async (...args: TArgs): Promise<TData | null> => {
      paramsRef.current = args;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setLoading(true);
      setErrorMessage(null);

      try {
        const next = await fetcherRef.current(...args);
        if (requestId !== requestIdRef.current) {
          return null;
        }

        setData(next);
        setError(null);
        onSuccess?.(next);
        return next;
      } catch (caught) {
        if (requestId !== requestIdRef.current) {
          return null;
        }

        setError(caught);
        setErrorMessage(formatError ? formatError(caught) : null);
        onError?.(caught);
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [formatError, onError, onSuccess],
  );

  const refetch = useCallback(async (): Promise<void> => {
    await run(...paramsRef.current);
  }, [run]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 请求本身会先置 loading，这是数据读取的预期行为，不是级联渲染。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(...paramsRef.current);
    // 依赖由调用方显式声明，避免把 fetcher 的闭包变化当成重新请求的信号。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const mutate = useCallback((next: TData | ((current: TData | null) => TData)): void => {
    setData((current) => (typeof next === 'function' ? (next as (value: TData | null) => TData)(current) : next));
  }, []);

  const reset = useCallback((): void => {
    requestIdRef.current += 1;
    setData(null);
    setError(null);
    setErrorMessage(null);
    setLoading(false);
  }, []);

  return { data, loading, error, errorMessage, run, refetch, mutate, reset };
}
