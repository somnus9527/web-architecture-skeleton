# 网络状态与离线规则

## 目的

本文件描述 React Native 应用对网络状态的感知、离线 fallback、自动重连与缓存策略。

## 网络状态检测

### 依赖

- 使用 `@react-native-community/netinfo`（最新稳定版）。
- 通过封装层 `src/domain/network/network-store.ts` 暴露 store；业务代码不直接 import `@react-native-community/netinfo`。

### Network Store

```ts
// src/domain/network/network-store.ts
import { create } from 'zustand';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown' | 'other';

export interface INetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null; // null 表示尚未检测
  type: NetworkType;
  subscribe: () => () => void;
}

export const useNetworkStore = create<INetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: null,
  type: 'unknown',
  subscribe: () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isConnected: Boolean(state.isConnected),
        isInternetReachable: state.isInternetReachable,
        type: (state.type as NetworkType) ?? 'unknown',
      });
    });
    return unsubscribe;
  },
}));
```

### Bridge

```tsx
// src/components/providers/network-bridge.tsx
export function NetworkBridge() {
  useEffect(() => useNetworkStore.getState().subscribe(), []);
  return null;
}
```

在 root provider 组合器中挂载（与 `QueryFocusBridge` 同级）。

## React Query 与离线

### onlineManager 桥接

`@tanstack/react-query` 的 `onlineManager` 默认依赖浏览器的 `navigator.onLine`，RN 中需要桥接到 `NetInfo`：

```ts
// src/components/providers/query-online-bridge.tsx
import { useEffect } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useNetworkStore } from '@domain/network/network-store';

export function QueryOnlineBridge() {
  useEffect(() => {
    return useNetworkStore.subscribe((state) => {
      onlineManager.setOnline(state.isConnected);
    });
  }, []);
  return null;
}
```

### Query 行为

- 离线时 `useQuery` 不发起请求；恢复在线后自动 refetch（配合 `refetchOnReconnect: true`，详见 `docs/rules/rn/state-management.md`）。
- 离线时如缓存有数据，UI 继续显示缓存数据。
- 离线时如缓存为空，UI 显示离线提示（见下文）。

## UI 状态

### 离线指示

应用顶部或 status bar 区域显示离线 banner：

```tsx
function OfflineBanner() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const { t } = useTranslation();

  if (isConnected) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={...}>
      <Text>{t('network.offline.banner')}</Text>
    </View>
  );
}
```

挂载位置：在 root provider 组合器内，作为 `<children>` 的兄弟节点；不要每个 screen 各自重复。

### 离线空态

无缓存 + 离线时，screen 渲染专用 EmptyState：

```tsx
if (query.isError && !isConnected) {
  return (
    <EmptyState
      context="offline"
      title={t('network.offline.title')}
      description={t('network.offline.description')}
      actionLabel={t('network.offline.retry')}
      onAction={() => query.refetch()}
    />
  );
}
```

### 离线动作禁用

涉及网络写操作的按钮（提交表单、创建远端资源、触发外部 handoff）在离线时 disabled：

```tsx
const isConnected = useNetworkStore((s) => s.isConnected);

<Button
  label={t('form.submit')}
  disabled={!isConnected || !isFormValid}
  loading={mutation.isPending}
  onPress={handleSubmit}
/>;
```

## 自动重连与重试

### Query 重试

参考 `docs/rules/rn/state-management.md`：

- 5xx 服务端错误 retry ≤ 2 次。
- 4xx 不 retry（业务错误，重试无意义）。
- 网络错误（status 0）默认 retry 2 次，每次指数退避。

### Mutation 重试

默认 `retry: 0`（避免重复写入）。如业务需要可在调用处显式开启。

### 长时间断网恢复

App 长时间断网恢复后：

1. `NetInfo` 触发 reconnect 事件。
2. `onlineManager.setOnline(true)` 通知 React Query。
3. 所有 stale query 自动 refetch（`refetchOnReconnect: true`）。
4. 离线 banner 自动消失。

## 离线持久化

### 草稿 / 偏好

- 离线可写：业务草稿、locale 偏好、theme 偏好 → 写入 AsyncStorage，恢复在线后同步到后端。
- 离线不可写：创建远端资源、外部 handoff、修改敏感账户信息 → 直接禁用入口。

### Optimistic Update + 重连同步

- 离线下用户操作（如调整本地草稿条目）可走 optimistic update：
  - 本地立刻更新 state + AsyncStorage。
  - 上线后通过 mutation 同步到后端。
- 同步失败时 rollback + 提示用户。

### 离线队列（可选）

- 复杂场景（用户离线发送多个动作）可引入离线队列：
  - 用户动作 enqueue 到本地。
  - 上线后按序 dispatch。
  - 失败的留在队列重试 / 用户手动确认。
- 评估收益：业务是否真的需要支持完全离线？如不是必需，不引入。

## 慢网络

### 区分"无网络"与"慢网络"

- `NetInfo` 仅反映 connected 状态；不反映带宽与延迟。
- 慢网络的 UX 由 React Query loading 状态 + 适当的 timeout 处理：
  - 关键接口设 `signal` + `AbortController` 配合 query 超时。
  - 超时后 retry，仍超时则显示错误态。

### Timeout 配置

```ts
const QUERY_TIMEOUT_MS = 15_000;

async function fetchWithTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new ApiError('Request timeout', 0)), QUERY_TIMEOUT_MS)),
  ]);
}
```

Timeout 决策落到 endpoint wrapper 或全局配置。

## i18n 文案

离线场景文案 key：

```
network.offline.banner   # "当前无网络连接"
network.offline.title    # "网络已断开"
network.offline.description  # "请检查网络连接后重试"
network.offline.retry    # "重试"
network.offline.actionDisabled  # "离线状态下无法执行该操作"
```

## 测试

- mock `@react-native-community/netinfo`：测试中 fake `addEventListener` 派发状态变化。
- 关键 screen 覆盖：离线状态下渲染 offline EmptyState / 在线状态正常渲染。
- onlineManager 桥接测试：状态变化触发 `onlineManager.setOnline`。

## 完成检查

- 业务代码不直接 import `@react-native-community/netinfo`。
- `NetworkBridge` 与 `QueryOnlineBridge` 在 root provider 中挂载。
- 离线 banner 在 App 顶层渲染；不重复挂载。
- 离线时网络写操作按钮 disabled。
- 离线 + 无缓存场景渲染 offline EmptyState。
- 上线后 stale query 自动 refetch。
- 离线文案 i18n。
