# 错误处理规则

## 目的

本文件描述 React Native 项目的错误处理金字塔：组件级 catch、Query onError、Native action 失败、ErrorBoundary 顶层兜底、与 logger 上报的衔接。

## 错误处理金字塔

```
┌─────────────────────────────────────┐
│ ErrorBoundary (顶层 fallback UI)     │  最后一道防线
├─────────────────────────────────────┤
│ Query / Mutation onError             │  请求级
├─────────────────────────────────────┤
│ 组件 try/catch + toast               │  交互级
├─────────────────────────────────────┤
│ ApiError + Native action failure    │  底层错误归一
└─────────────────────────────────────┘
```

每一层都不允许"静默吞掉"错误；至少要 `logger.warn` 或 `logger.error`。

## 韧性落地边界

App 韧性基线由三部分共同组成：

- 顶层兜底：`app/_layout.tsx` 挂载 `ErrorBoundary`，fallback 文案走 i18n，reset 只重置 boundary 内部状态，不清空 navigation history、store 或 query cache。
- 请求级韧性：`QueryClient` defaults、query 三态与 `AppState` 到 `focusManager` 的桥接由 `docs/rules/rn/state-management.md` 约束。
- 错误上报：ErrorBoundary、关键 catch 与 mutation / query 错误路径通过 `@api/logger` 留痕；reporter 注入与 redaction 规则见 `docs/rules/rn/observability.md`。

## ApiError（底层归一）

- API client 把所有错误（HTTP 非 2xx / 网络 / JSON 解析）统一抛 `ApiError`。
- 详见 `docs/rules/rn/api.md`。

```ts
try {
  const data = await getItemDetail(id);
} catch (error) {
  if (error instanceof ApiError && error.status === 404) {
    return null;
  }
  throw error;
}
```

## Native action 失败（交互级）

- 所有 native 动作必须用 `*WithFailureToast` helper。
- 详见 `docs/rules/rn/native-actions.md`。

## Query / Mutation onError（请求级）

### Mutation onError

通常派发 toast：

```tsx
const submitMutation = useMutation({
  mutationFn: submitForm,
  onError: (error) => {
    const message = error instanceof ApiError ? error.message : t('form.error.generic');
    pushToast({ title: message, variant: 'error' });
  },
});
```

### Query 错误展示

通过 `query.isError` + `query.error` 在 UI 中渲染错误态：

```tsx
if (query.isError) {
  return (
    <EmptyState
      context="error"
      title={t('common.error.title')}
      description={query.error instanceof ApiError ? query.error.message : t('common.error.generic')}
      actionLabel={t('common.error.retry')}
      onAction={() => query.refetch()}
    />
  );
}
```

### 全局 onError（可选）

如需统一上报，QueryClient 可配全局 onError：

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: ..., // 见 docs/rules/rn/state-management.md
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      logger.warn('query_error', { error });
    },
  }),
});
```

## 组件 try/catch（交互级）

### 异步 handler

```tsx
async function handleCopy() {
  try {
    await copyTextWithFailureToast(value, { title: t('toast.copyFailed'), pushToast });
    pushToast({ title: t('toast.copySuccess'), variant: 'info' });
  } catch (error) {
    logger.error('copy_failed', { error });
  }
}
```

### 不要 catch 后吞掉

```tsx
// 禁止
try {
  await something();
} catch {
  // 空
}

// 推荐：至少有 logger
try {
  await something();
} catch (error) {
  logger.warn('something_failed', { error });
}
```

## ErrorBoundary（顶层）

### 必须挂载

`app/_layout.tsx` 必须在 `AppProviders` 外或内层包 `ErrorBoundary`。完整组件、Fallback UI 与挂载方式见 `docs/rules/rn/templates/error-boundary.md`。

```tsx
// app/_layout.tsx
export default function RootLayout() {
  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}>
      <AppProviders>
        <Stack>...</Stack>
      </AppProviders>
    </ErrorBoundary>
  );
}
```

### 嵌套 ErrorBoundary

- 顶层挂一个全局 boundary。
- 关键 feature 可挂局部 boundary，避免一个 feature 崩溃整 App 白屏。
- 局部 boundary 的 fallback 提供"回到 X 入口"等业务侧 reset 路径。

## 错误上报

ErrorBoundary 与 logger.error 都需要对接错误上报 reporter（详见 `docs/rules/rn/observability.md`）：

```ts
componentDidCatch(error: Error, info: ErrorInfo): void {
  logger.error('boundary_caught', { error, componentStack: info.componentStack });
  this.props.onError?.(error, info);
}
```

## 不要做的事

- 静默 `catch {}`：哪怕业务上"不需要处理"也要 logger.debug 留痕。
- `try { ... } catch (e) { throw e }`：无意义包裹，去掉。
- catch 后展示 stack trace 给用户：泄漏实现细节。
- 异步函数无 catch 调用：`void doAsync()` 必须在内部处理错误，或在调用方 `.catch()`。

## 完成检查

- 所有 async handler 有 try/catch + toast 或 logger。
- 所有 mutation 有 onError。
- 所有 query 渲染处理 isError 分支。
- 顶层挂载 ErrorBoundary。
- 失败 toast 文案 i18n。
- 不出现静默 `catch {}`。
- 错误上报对接 logger。
