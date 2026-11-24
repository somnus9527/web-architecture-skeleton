# 启动 Discipline 规则

## 目的

本文件描述 React Native 项目的 `app/_layout.tsx` 准则、Provider 嵌套顺序、splash 隐藏时机与首屏 query 预取。

## `app/_layout.tsx` 准则

### 允许做的

- 挂载 root Provider 组合器（`AppProviders`）。
- 渲染 `<Stack>` + 一级 Screen 声明（如 `(tabs)`、`(auth)`、`(modals)`、`(static)`、`+not-found`）。
- 渲染 `<StatusBar style="auto" />`。
- 顶层 `ErrorBoundary` 挂载（在 `AppProviders` 外层）。

### 禁止做的

- 直接 `useQuery` 或 `useMutation`。
- 调用 `fetch` 或 API endpoint wrapper。
- `import @api/*` / `@storage/*`。
- 读取业务 store state。
- 含业务计算、格式化、字符串拼接。
- 写文案（除 `<Stack.Screen>` title 等，且必须 i18n）。

### 标准实现

```tsx
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

ErrorBoundary 模版见 `docs/rules/rn/templates/error-boundary.md`。

### 架构测试守护

新增 / 维护 `src/test/architecture/root-layout-discipline.test.ts`：

- 扫描 `app/_layout.tsx`，禁止出现 `useQuery`、`fetch(`、`@api/`、`@storage/` import。
- 要求只挂载 `AppProviders` + `Stack` + `StatusBar` + `ErrorBoundary`，不允许扩散业务 JSX。

## Provider 嵌套顺序

### 嵌套原则（按层级、不按具体 Provider 名）

Provider 嵌套按**依赖关系**从外到内排序。每个 Provider 仅依赖**更外层**的 Provider。新增 Provider 时按下表归类，插入到对应层级中。

| 层级               | 职责                                          | 典型代表                                                                                                                 |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1. 数据层          | 远端缓存、网络请求管理                        | `QueryClientProvider`（React Query）                                                                                     |
| 2. 平台 / 安全区   | RN 平台能力、设备 safe area                   | `SafeAreaProvider`、`GestureHandlerRootView`（如启用）                                                                   |
| 3. 主题 / 视觉系统 | 设计 token、配色、字号                        | `ThemeProvider`（项目自有）                                                                                              |
| 4. UI 库 Provider  | 第三方 UI 库的全局 provider                   | `PaperProvider`（React Native Paper）                                                                                    |
| 5. 国际化          | i18n / locale 切换                            | `LocaleProvider`                                                                                                         |
| 6. 会话 / 认证     | session 恢复、auth token、用户身份            | `SessionProvider`                                                                                                        |
| 7. 全局反馈        | toast 队列、global modal、网络状态 banner     | `ToastProvider`、`OfflineBannerProvider`                                                                                 |
| 8. 桥接 / 监听     | AppState、analytics 派发、deep link、推送监听 | `QueryFocusBridge`、`QueryOnlineBridge`、`AnalyticsBridge`、`DeepLinkBridge`、`PushNotificationsBridge`、`NetworkBridge` |

桥接组件（第 8 层）通常 `return null`，挂载在 `{children}` 兄弟位置而非外层包裹。

### 示例：典型 root provider 组合

```tsx
// src/components/providers/app-providers.tsx
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {' '}
      {/* 1. 数据层 */}
      <SafeAreaProvider initialMetrics={safeAreaInitialMetrics}>
        {' '}
        {/* 2. 平台 */}
        <ThemeProvider>
          {' '}
          {/* 3. 主题 */}
          <PaperThemeProvider>
            {' '}
            {/* 4. UI 库 */}
            <LocaleProvider>
              {' '}
              {/* 5. i18n */}
              <SessionProvider>
                {' '}
                {/* 6. 会话 */}
                <ToastProvider>
                  {' '}
                  {/* 7. 全局反馈 */}
                  {/* 8. 桥接组件，return null，按需挂载 */}
                  <NetworkBridge />
                  <QueryOnlineBridge />
                  <QueryFocusBridge />
                  <AnalyticsBridge />
                  <DeepLinkBridge />
                  <PushNotificationsBridge />
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

### 新增 Provider

按"它依赖什么、什么依赖它"判断层级：

- 依赖 Query → 在第 1 层内。
- 依赖 token → 在第 3 层内。
- 依赖 i18n → 在第 5 层内。
- 依赖 session → 在第 6 层内。
- 派发 toast → 在第 7 层内。
- 仅监听 RN 平台事件（AppState、Linking、Notifications）→ 桥接组件，第 8 层。

不在 Provider 视图内做业务计算；Provider 只挂载子树 + 暴露 context。

### Provider context value 稳定

每个 Provider 的 context value 必须 `useMemo` 稳定，否则上层 re-render 触发整树：

```tsx
const value = useMemo<IThemeContextValue>(
  () => ({ themePreference, resolvedTheme, tokens, setThemePreference }),
  [resolvedTheme, themePreference, tokens],
);
```

Provider 模版见 `docs/rules/rn/templates/provider.md`。

## Splash 隐藏时机

### 策略选择

Splash 隐藏时机是启动体验策略，不是所有项目都必须无条件显式控制。

- 默认策略：Expo Router 启动后在路由 ready 时自动隐藏 splash。若首屏不会出现错误语言、匿名态闪烁或 hydration 前后大幅跳变，可保留默认。
- 显式控制：当 locale resolution、session restore 或关键本地 store hydration 会影响首屏身份、语言或导航守卫时，引入 `expo-splash-screen`，等待必要 hydration ready 后隐藏。
- 决策记录：从默认策略切到显式控制时，需要在对应 todo / record 中说明触发原因、ready 信号和平台验收方式。

### 显式控制实现

```tsx
// app/_layout.tsx
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}>
      <AppProviders>
        <SplashController /> {/* 内部等待 hydration ready 后调 hideAsync */}
        <Stack>...</Stack>
      </AppProviders>
    </ErrorBoundary>
  );
}
```

```tsx
// src/components/providers/splash-controller.tsx
function SplashController() {
  const localeReady = useLocaleStore((s) => s.hasHydrated);
  const sessionReady = useSessionStore((s) => s.hasLoaded);

  useEffect(() => {
    if (localeReady && sessionReady) {
      void SplashScreen.hideAsync();
    }
  }, [localeReady, sessionReady]);

  // 超时保护：3 秒强制隐藏
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync(), 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
```

### Splash UX

- splash 上不显示文案（避免 i18n 时序问题）；只显示 logo。
- splash 背景色与首屏一致，避免闪屏。
- 显式控制时必须有超时兜底，避免某个 provider 卡住导致 splash 永远不隐藏；3 秒是上限。
- 显式控制时 `hideAsync()` 必须只调用一次，失败路径走 logger，且完成前需要有模拟器或真机平台验收记录。

## 首屏 Query 预取

### 策略选择

首屏 query 预取是性能与体验取舍，不是架构硬门禁。

- 默认策略：不在 root provider 无条件预取业务 query，保留 screen lazy load，避免冷启动期间多发请求。
- 可启用场景：已有真实数据证明核心首屏 loading 明显影响体验，且预取 query 足够小、稳定、可被首屏复用。
- 禁止场景：不预取整个首屏的所有 query；次级数据、reviews、推荐位、长列表等继续 lazy load。
- 决策记录：无论选择启用还是暂不启用，都在对应 record 记录原因；启用时至少覆盖一个核心 query 的测试。

### 可选实现

```tsx
// 在 AppProviders 内或 LocaleProvider 之后挂一个 PrefetchBootstrap 组件
useEffect(() => {
  void queryClient.prefetchQuery({
    queryKey: ['home', 'bootstrap', locale, currency],
    queryFn: () => getHomeBootstrap({ locale, currency }),
  });
}, [locale, currency]);
```

### Trade-off

- 优点：用户进入首屏看不到 loading。
- 缺点：冷启动期间多发一次请求，占用启动期带宽。
- 仅对核心 query 做预取；非核心保留 lazy load。

## 启动流程时间预算

| 阶段                                    | 时间预算                  | 说明                                |
| --------------------------------------- | ------------------------- | ----------------------------------- |
| Native splash 显示                      | 0 ms                      | 系统级，立即可见                    |
| JS bundle 加载                          | 0–1.5 s                   | 由 Hermes / Metro 决定              |
| AppProviders 初始化                     | < 100 ms                  | 不含 IO                             |
| LocaleProvider hydration                | < 100 ms                  | 读 AsyncStorage                     |
| Session hydration                       | < 200 ms                  | 读 SecureStore + 可能 token refresh |
| Splash hideAsync（如显式控制）          | 在必要 hydration ready 后 | 上限 3 s（超时保护）                |
| 首屏 Provider 树 mount                  | < 200 ms                  |                                     |
| 首屏首次渲染                            | < 400 ms                  | 含 query loading skeleton           |
| 首屏数据 ready（query prefetch 命中时） | < 600 ms                  | 仅在启用预取时适用                  |

冷启动到首屏可交互目标：**iOS < 1.5 s，Android < 2.5 s（中端机）**。

## Hydration 顺序

- LocaleProvider 与 SessionProvider 在 mount 时各自 hydrate；并行进行。
- 业务 Store 的 hydration 在对应 Provider mount 后触发：
  ```tsx
  useEffect(() => {
    void useFeatureStore.getState().hydrateDraft();
  }, []);
  ```
- 不在 `app/_layout.tsx` 直接调 store hydration（违反 layout discipline）。

## 完成检查

- `app/_layout.tsx` ≤ 30 行；只挂载 ErrorBoundary + AppProviders + Stack。
- 不出现 `useQuery` / `fetch` / `@api` / `@storage` import。
- Provider 嵌套按"数据 → 平台 → 主题 → UI 库 → i18n → 会话 → 全局反馈 → 桥接"层级。
- 新增 Provider 按依赖关系归类，不打乱已有顺序。
- Provider context value `useMemo` 稳定。
- Splash 隐藏时机有明确策略：保留 Expo Router 默认自动隐藏，或启用显式控制；显式控制时等待必要 hydration ready，超时 3 s 强制隐藏，并记录平台验收。
- 首屏 query prefetch 有明确决策：默认不在 root provider 无条件预取；如启用，记录核心 query、复用路径和测试证据。
- 冷启动时间符合预算。
