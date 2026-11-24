import { useEffect, useState } from 'react';

/**
 * 返回延迟更新的值，用于搜索输入等高频变化的场景。
 *
 * 只做去抖，不掺请求；需要请求时由调用方把结果交给 `useRequest`。
 *
 * @param value - 原始值。
 * @param delayMs - 延迟毫秒数。
 * @returns 去抖后的值。
 */
export function useDebouncedValue<TValue>(value: TValue, delayMs = 300): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
