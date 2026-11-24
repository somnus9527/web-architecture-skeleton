# WebView 规则

## 目的

本文件描述 React Native 应用嵌入 WebView 的安全约束、来源白名单、桥接通信与隐私规则。

## 何时使用 WebView

### 适用场景

- 嵌入第三方支付 / KYC / 银行流程（无法用原生 SDK 替代）。
- 嵌入静态 help center / 营销活动页（频繁迭代且不值得做原生）。
- 嵌入合作伙伴流程（受品牌方约束必须 web）。

### 不适用场景

- 常规业务页面（用原生 RN）。
- 含敏感输入的页面（除非 web 来源可信）。
- 性能敏感的列表 / 表单。

## 依赖

- 使用 `react-native-webview`（最新稳定版）。
- 通过封装层 `src/components/ui/safe-webview.tsx` 统一接入，业务代码不直接 import `react-native-webview`。

## 来源白名单

### 必须配置 originWhitelist

所有 WebView 必须显式设置 `originWhitelist`，禁止默认通配：

```tsx
<WebView
  source={{ uri }}
  originWhitelist={['https://www.example.com', 'https://trusted.example.com']}
  // ...
/>
```

### 入口 URL 校验

通过 WebView 加载的 URL 必须经过 `@domain/safe-url.assertAllowedUrl` 校验；详见 `docs/rules/rn/security.md`。

### onShouldStartLoadWithRequest 拦截

每次导航前再次校验目标 URL：

```tsx
function handleShouldStart(request: ShouldStartLoadRequest): boolean {
  if (!isAllowedUrl(request.url)) {
    logger.warn('webview_navigation_blocked', { url: request.url });
    return false;
  }
  return true;
}

<WebView onShouldStartLoadWithRequest={handleShouldStart} ... />
```

- iOS 与 Android 行为差异：Android 需要同时检查 `request.isTopFrame`，否则只能拦截顶层导航。

## 安全配置

### 必须关闭的能力

```tsx
<WebView
  javaScriptEnabled // 通常需要；如果纯静态可关
  domStorageEnabled // 通常需要
  thirdPartyCookiesEnabled={false} // 默认禁用第三方 cookie
  allowsBackForwardNavigationGestures={false} // 防止用户后退到非预期页
  setSupportMultipleWindows={false} // 禁止 window.open 弹出新窗口
  mixedContentMode="never" // 不允许 HTTP 资源在 HTTPS 页面加载
  allowFileAccess={false} // 禁止访问本地文件
  allowUniversalAccessFromFileURLs={false}
  allowsLinkPreview={false} // iOS 长按预览关闭
/>
```

### iOS 特有

- `decelerationRate="normal"`。
- `allowsInlineMediaPlayback`：仅在需要嵌入视频时开启。
- `mediaPlaybackRequiresUserAction`：默认 `true`，防止自动播放。

### Android 特有

- `setBuiltInZoomControls={false}`：通常关闭手势缩放（除非 web 内容是文章阅读）。
- `androidLayerType="hardware"`：默认；性能差的设备可改 `software`。

## JS Bridge（postMessage）

### 单向通信

- Web → Native：`window.ReactNativeWebView.postMessage(JSON.stringify(payload))`
- Native → Web：`webViewRef.current?.injectJavaScript(jsCode)`

### Schema 约定

```ts
interface IWebMessage {
  type: 'navigate' | 'close' | 'open_native_action' | ...;
  payload?: Record<string, unknown>;
}
```

### 接收消息时必须校验

```tsx
function handleMessage(event: WebViewMessageEvent) {
  let message: IWebMessage;
  try {
    message = JSON.parse(event.nativeEvent.data);
  } catch {
    logger.warn('webview_invalid_message', { data: event.nativeEvent.data });
    return;
  }

  // 按 type 白名单分发，未知 type 直接 ignore
  switch (message.type) {
    case 'navigate':
      // 校验 payload.path 走 safe-navigate
      break;
    case 'close':
      // 关闭 webview
      break;
    default:
      logger.warn('webview_unknown_type', { type: message.type });
  }
}

<WebView onMessage={handleMessage} ... />
```

### 注入 JS 时不传秘密

- `injectJavaScript` 注入的代码会成为 web 页可见 / 可读的 JS；不要在其中包含 token、签名 key、API key。
- 需要传 token 给可信 web 页时，通过 URL query 或 Authorization header（取决于 web 端读取方式）。

## 加载态与错误态

```tsx
function SafeWebView({ uri, onClose }: ISafeWebViewProps) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          logger.error('webview_load_error', { error: e.nativeEvent });
          // 渲染降级 UI
        }}
        // ...
      />
      {loading && <LoadingOverlay />}
    </View>
  );
}
```

## 离开页面 / 关闭

- 用户通过 native header back 关闭 WebView 时，先调 `webViewRef.current?.injectJavaScript('window.onAppClose && window.onAppClose()')` 让 web 端清理（如有需要）。
- Android 硬件 back：默认会触发 WebView 内部 back 而不是页面关闭；必须在 `onAndroidBackPress` 中处理，若 web 不能再 back 则关闭 WebView。

## 性能

- WebView 实例不复用；切换 URL 用 `source={{ uri }}` 变更。
- 单页内不要嵌入多个 WebView（占用内存大）。
- 内存压力大的设备上 WebView 可能崩溃；保留 `onContentProcessDidTerminate`（iOS）/ `onRenderProcessGone`（Android）回调，崩溃后重新渲染。

## 测试

- WebView 在 jest 中难以渲染；测试 wrapper 组件的 props 传递与 message handler 逻辑，不测试 web 实际加载。

## 完成检查

- 业务代码不直接 import `react-native-webview`，通过 `@components/ui/safe-webview` 接入。
- `originWhitelist` 必填、`onShouldStartLoadWithRequest` 必填。
- 关键安全配置（`thirdPartyCookies` / `mixedContent` / `fileAccess`）按规则禁用。
- `postMessage` schema 约定，接收时校验 type 白名单。
- 注入 JS 不含 token / secret。
- 加载态、错误态、Android 硬件 back 都处理。
