# ErrorBoundary 模版

> 上级规则：`docs/rules/rn/error-handling.md`、`docs/rules/rn/observability.md`。

## 适用场景

顶层兜底 ErrorBoundary，配合 logger 错误上报与降级 UI。

## 完整模版

### ErrorBoundary 组件

```tsx
// src/components/providers/error-boundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { logger } from '@api/logger';

interface IErrorBoundaryProps {
  /**
   * 出错时渲染的降级 UI。`error` 传入捕获到的异常，`reset` 触发恢复。
   */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /**
   * 可选错误回调，便于业务侧自定义上报或埋点。
   */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * 子树。
   */
  children: ReactNode;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React 顶层兜底 ErrorBoundary。捕获子树渲染期的同步异常。
 *
 * 注意：不能捕获 async 异常、事件 handler 内未 catch 的错误、
 * SSR 异常。Async 错误必须在调用点 try/catch 自行处理。
 */
export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  state: IErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('boundary_caught', {
      error,
      componentStack: info.componentStack,
    });
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
```

### Fallback UI

```tsx
// src/components/providers/error-fallback.tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@components/ui/button';
import { useThemeTokens } from '@theme/theme-provider';

interface IErrorFallbackProps {
  /**
   * 捕获到的异常；用于 dev 环境展示，prod 不暴露给用户。
   */
  error: Error;
  /**
   * 重置 ErrorBoundary 状态，重新渲染子树。
   */
  onReset: () => void;
}

/**
 * 默认降级 UI。dev 模式展示 stack 信息；prod 仅展示友好文案。
 */
export function ErrorFallback({ error, onReset }: IErrorFallbackProps) {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.colors.surface, paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { padding: tokens.spacing.xl }]}
    >
      <View style={[styles.card, { gap: tokens.spacing.md }]}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.colors.textPrimary, fontSize: tokens.typography.title }]}
        >
          {t('errors.boundary.title')}
        </Text>
        <Text style={[styles.description, { color: tokens.colors.textSecondary, fontSize: tokens.typography.body }]}>
          {t('errors.boundary.description')}
        </Text>

        {/* dev 模式展示完整 stack，prod 不暴露 */}
        {__DEV__ && (
          <View
            style={[
              styles.devBox,
              {
                backgroundColor: tokens.colors.surfaceMuted,
                padding: tokens.spacing.md,
                borderRadius: tokens.radius.sm,
              },
            ]}
          >
            <Text style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption }}>
              {error.name}: {error.message}
            </Text>
            {error.stack && (
              <Text
                style={{
                  color: tokens.colors.textMuted,
                  fontSize: tokens.typography.caption,
                  marginTop: 8,
                }}
              >
                {error.stack}
              </Text>
            )}
          </View>
        )}

        <Button label={t('errors.boundary.reset')} onPress={onReset} testID="error-boundary-reset" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  card: { alignItems: 'stretch' },
  title: { fontWeight: '700', textAlign: 'center' },
  description: { textAlign: 'center' },
  devBox: { maxHeight: 320 },
});
```

### 在 root layout 挂载

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@components/providers/app-providers';
import { ErrorBoundary } from '@components/providers/error-boundary';
import { ErrorFallback } from '@components/providers/error-fallback';
import { ROOT_STACK_SCREENS } from '@components/navigation/root-navigation-config';

export default function RootLayout() {
  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}>
      <AppProviders>
        <StatusBar style="auto" />
        <Stack>
          {ROOT_STACK_SCREENS.map((screen) => (
            <Stack.Screen key={screen.name} name={screen.name} options={screen.options} />
          ))}
        </Stack>
      </AppProviders>
    </ErrorBoundary>
  );
}
```

### 嵌套 ErrorBoundary（feature 级）

关键 feature 可以挂局部 ErrorBoundary，避免一个 feature 崩溃影响整个 App：

```tsx
// src/components/<feature>/feature-route-wrapper.tsx
function FeatureFallback({ error, onReset }: IErrorFallbackProps) {
  // 自定义文案 + 返回 feature 入口
  return (
    <View>
      <Text>{t('feature.error.title')}</Text>
      <Button label={t('common.retry')} onPress={onReset} />
      <Button
        label={t('feature.error.backToList')}
        onPress={() => router.replace({ pathname: '/<feature>' })}
        variant="ghost"
      />
    </View>
  );
}

export function FeatureRouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={(error, reset) => <FeatureFallback error={error} onReset={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
```

## 注意点

- **fallback 是函数**：避免在父组件 re-render 时 fallback 被 unmount/remount；接收 `error` 与 `reset` 入参。
- **不能捕获 async 异常**：异步动作必须在调用点 try/catch；ErrorBoundary 是最后一道防线，不是替代。
- **dev 暴露 stack，prod 不暴露**：通过 `__DEV__` gate。
- **logger.error 自动调**：`componentDidCatch` 内已调；外部 `onError` 是补充钩子，不重复打日志。
- **fallback UI 必须可重置**：用户点击 reset 后子树重新渲染；若同一 error 持续，会再次进入 fallback。
- **i18n 文案**：标题、描述、按钮文案都走 `t(key)`。

## i18n 文案 Key

```
errors.boundary.title        # "出了一点问题"
errors.boundary.description  # "应用遇到错误，请重试。如果问题持续，请联系客服。"
errors.boundary.reset        # "重试"
```

## 测试

```tsx
// src/test/components/error-boundary.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '@components/providers/error-boundary';

function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <Text>OK</Text>;
}

describe('ErrorBoundary', () => {
  // 抑制 React 的 console.error 噪声
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary fallback={(_, __) => <Text>FB</Text>}>
        <BombComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('OK')).toBeOnTheScreen();
  });

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary fallback={(error, _) => <Text>{`FB: ${error.message}`}</Text>}>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('FB: boom')).toBeOnTheScreen();
  });

  it('resets state after reset', () => {
    let shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary fallback={(_, reset) => <Text onPress={reset}>reset</Text>}>
        <BombComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('reset')).toBeOnTheScreen();

    shouldThrow = false;
    fireEvent.press(screen.getByText('reset'));
    rerender(
      <ErrorBoundary fallback={(_, reset) => <Text onPress={reset}>reset</Text>}>
        <BombComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('OK')).toBeOnTheScreen();
  });

  it('calls onError with error info', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary fallback={(_, __) => <Text>FB</Text>} onError={onError}>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });
});
```
