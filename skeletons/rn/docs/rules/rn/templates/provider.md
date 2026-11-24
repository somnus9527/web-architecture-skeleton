# Provider 模版

> 上级规则：`docs/rules/rn/state-management.md`、`docs/rules/rn/architecture.md`、`docs/rules/rn/startup.md`。
>
> 建议落地位置：`src/theme/theme-provider.tsx`、`src/domain/toast/toast-provider.tsx` 等。

## 适用场景

需要跨组件树注入服务、配置或 dispatcher 时。

## 简单 Provider（无状态）

```tsx
// src/domain/toast/toast-provider.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface IToastItem {
  id: string;
  title: string;
  variant: ToastVariant;
}

export interface IToastDispatcher {
  (toast: { title: string; variant?: ToastVariant }): void;
}

interface IToastContextValue {
  /**
   * 当前展示的 toast 队列。
   */
  toasts: IToastItem[];
  /**
   * 派发新 toast。
   */
  pushToast: IToastDispatcher;
  /**
   * 关闭指定 toast。
   */
  dismissToast: (id: string) => void;
}

interface IToastProviderProps {
  children: ReactNode;
  /**
   * Toast 自动消失时长，默认 3500ms。
   */
  autoDismissMs?: number;
}

const ToastContext = createContext<IToastContextValue | null>(null);

/**
 * Toast Provider 管理全局 toast 队列。
 */
export function ToastProvider(props: IToastProviderProps) {
  const { children, autoDismissMs = 3500 } = props;
  const [toasts, setToasts] = useState<IToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback<IToastDispatcher>((toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, title: toast.title, variant: toast.variant ?? 'info' }]);
  }, []);

  // 自动清理超过 autoDismissMs 的 toast
  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => dismissToast(oldest.id), autoDismissMs);
    return () => clearTimeout(timer);
  }, [toasts, autoDismissMs, dismissToast]);

  const value = useMemo<IToastContextValue>(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * 派发 toast 的 hook。
 */
export function useAppToast(): IToastDispatcher {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useAppToast must be used within ToastProvider');
  }
  return context.pushToast;
}

/**
 * 读取当前 toast 队列（通常只在 ToastViewport 中使用）。
 */
export function useToastQueue(): IToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastQueue must be used within ToastProvider');
  }
  return context;
}
```

## 业务状态 Provider（含 store hydration）

```tsx
// src/domain/session-provider.tsx
import { useEffect, type ReactNode } from 'react';
import { useSessionStore } from './session-store';

interface ISessionProviderProps {
  children: ReactNode;
}

/**
 * 在 mount 时触发 session 恢复，确保业务 query 能获得有效 token。
 */
export function SessionProvider({ children }: ISessionProviderProps) {
  const restoreSession = useSessionStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return <>{children}</>;
}
```

## Root Provider 组合器

```tsx
// src/components/providers/app-providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@theme/theme-provider';
import { PaperThemeProvider } from './paper-theme-provider';
import { LocaleProvider } from '@domain/locale/locale-provider';
import { SessionProvider } from '@domain/session-provider';
import { ToastProvider } from '@domain/toast/toast-provider';
import { AnalyticsBridge } from '@domain/analytics-bridge';
import { QueryFocusBridge } from './query-focus-bridge';
import { ToastViewport } from '@components/ui/toast';
import { ApiError } from '@api/errors';

/**
 * QueryClient 显式默认配置：staleTime、gcTime、retry、refetchOnReconnect。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

/**
 * Jest/SSR 环境下 initialWindowMetrics 可能为空。
 */
const safeAreaInitialMetrics = initialWindowMetrics ?? {
  frame: { height: 0, width: 0, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

interface IAppProvidersProps {
  children: React.ReactNode;
}

/**
 * 按"Query → SafeArea → Theme → Paper → Locale → Session → Toast"顺序嵌套 Provider。
 */
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
        <ThemeProvider>
          <PaperThemeProvider>
            <LocaleProvider>
              <SessionProvider>
                <ToastProvider>
                  <QueryFocusBridge />
                  <AnalyticsBridge />
                  {children}
                  <ToastViewport />
                </ToastProvider>
              </SessionProvider>
            </LocaleProvider>
          </PaperThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

## QueryFocusBridge 模版

```tsx
// src/components/providers/query-focus-bridge.tsx
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * 把 RN AppState 桥接到 React Query 的 focusManager。
 * 应用从后台回前台时触发 stale query refetch。
 */
export function QueryFocusBridge() {
  useEffect(() => {
    function handle(state: AppStateStatus) {
      focusManager.setFocused(state === 'active');
    }
    const subscription = AppState.addEventListener('change', handle);
    return () => subscription.remove();
  }, []);

  return null;
}
```

## 注意点

- **配套 hook**：每个 Provider 必须提供 `use<Name>` hook + null check throw。
- **value useMemo**：context value 必须 `useMemo` 稳定，否则上层 re-render 触发整树重渲染。
- **不在 Provider 视图内做计算**：Provider 只挂载子树 + 暴露 context。
- **拆分粒度**：一个 Provider 一个领域；不允许大杂烩 Provider。
- **嵌套顺序**：root provider 组合器中按依赖关系排序（被依赖的在外层）。
- **业务 vs UI 区分**：业务状态 Provider 放 `src/domain/*-provider.tsx`，UI 相关 Provider 放 `src/components/providers/*-provider.tsx`。

## 测试模版

```tsx
// src/test/providers/toast-provider.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { ToastProvider, useAppToast, useToastQueue } from '@domain/toast/toast-provider';

describe('ToastProvider', () => {
  it('throws when useAppToast used outside provider', () => {
    expect(() => renderHook(() => useAppToast())).toThrow();
  });

  it('pushes a toast', () => {
    const { result } = renderHook(() => ({ push: useAppToast(), queue: useToastQueue() }), {
      wrapper: ToastProvider,
    });

    act(() => result.current.push({ title: 'Hello', variant: 'info' }));

    expect(result.current.queue.toasts).toHaveLength(1);
    expect(result.current.queue.toasts[0].title).toBe('Hello');
  });

  it('auto dismisses after timeout', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => ({ push: useAppToast(), queue: useToastQueue() }), {
      wrapper: ({ children }) => <ToastProvider autoDismissMs={1000}>{children}</ToastProvider>,
    });

    act(() => result.current.push({ title: 'Hello' }));
    act(() => jest.advanceTimersByTime(1000));

    expect(result.current.queue.toasts).toHaveLength(0);
    jest.useRealTimers();
  });
});
```
