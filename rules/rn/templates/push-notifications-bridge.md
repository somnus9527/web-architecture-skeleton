# 推送通知 Bridge 模版

> 上级规则：`docs/rules/rn/push-notifications.md`、`docs/rules/rn/security.md`（deep link 白名单）、`docs/rules/rn/routing.md`（safe-navigate）、`docs/rules/rn/observability.md`（logger / token redaction）、`docs/rules/rn/storage.md`（token 缓存）。
>
> 建议落地位置：`src/components/providers/push-notifications-bridge.tsx` + `src/domain/notifications/*` + `src/api/endpoints/notifications.ts`。

## 适用场景与激活条件

- **条件能力**：仅在业务方决定需要远程推送时激活。
- 激活前提：安装 `expo-notifications`（最新稳定版），在 `app.json` 配置 `expo-notifications` plugin、iOS `aps-environment`、Android `POST_NOTIFICATIONS` 权限与 channel。
- 激活后：仅 `push-notifications-bridge.tsx` 与 `src/domain/notifications/*` 可 import `expo-notifications`；业务 screen 通过 store / hook 消费。

## 模块结构

```
src/
  components/providers/push-notifications-bridge.tsx   # 权限申请编排 + token 注册 + listener 挂载
  domain/notifications/
    types.ts                                            # payload schema + 类型守卫
    notification-store.ts                               # zustand：permission / token / 注册状态
    use-notification-handler.ts                         # 解析 payload + safe deep link 跳转
    register-device.ts                                  # 调 expo-notifications 获取 token（唯一接触点）
  api/endpoints/notifications.ts                        # token 上报 / 解绑 endpoint wrapper
```

## types.ts —— payload schema 与类型守卫

```ts
// src/domain/notifications/types.ts

/**
 * 后端推送 data 字段的业务类型；前端按 type 分发处理。
 */
export type PushPayloadType = 'entity_status_changed' | 'system_message' | 'promo' | 'message';

/**
 * 统一推送 payload 协议；与后端约定的 data 字段结构一致。
 */
export interface IPushPayload {
  /**
   * 业务事件类型；未知 type 前端安全忽略。
   */
  type: PushPayloadType;
  /**
   * 通知唯一 ID，用于去重与已读上报。
   */
  notificationId: string;
  /**
   * Deep link 路径；必须经 safe-url 白名单校验后才跳转。
   */
  link?: string;
  /**
   * 业务数据；前端按 type 解析，不信任其结构。
   */
  data?: Record<string, unknown>;
}

const KNOWN_TYPES: readonly PushPayloadType[] = ['entity_status_changed', 'system_message', 'promo', 'message'];

/**
 * 运行时校验推送 payload；payload 来自外部，必须先守卫再使用。
 */
export function parsePushPayload(raw: unknown): IPushPayload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  const { type, notificationId, link, data } = candidate;

  if (typeof type !== 'string' || !KNOWN_TYPES.includes(type as PushPayloadType)) return null;
  if (typeof notificationId !== 'string' || notificationId.length === 0) return null;
  if (link !== undefined && typeof link !== 'string') return null;

  return {
    type: type as PushPayloadType,
    notificationId,
    link,
    data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined,
  };
}
```

## notification-store.ts —— 权限 / token 状态

```ts
// src/domain/notifications/notification-store.ts
import { create } from 'zustand';

/**
 * 通知权限状态；映射 expo-notifications 的权限结果。
 */
export type NotificationPermission = 'undetermined' | 'granted' | 'denied';

interface INotificationState {
  /**
   * 当前系统通知权限。
   */
  permission: NotificationPermission;
  /**
   * 已注册到后端的 device push token；未注册为 null。
   */
  token: string | null;
  /**
   * token 是否正在上报，避免重复注册。
   */
  isRegistering: boolean;
  setPermission: (permission: NotificationPermission) => void;
  setToken: (token: string | null) => void;
  setRegistering: (value: boolean) => void;
  /**
   * 用户登出 / 撤销授权时清空本地通知状态。
   */
  reset: () => void;
}

/**
 * 全局通知状态 store；业务 screen 只读 permission / token。
 */
export const useNotificationStore = create<INotificationState>((set) => ({
  permission: 'undetermined',
  token: null,
  isRegistering: false,
  setPermission: (permission) => set({ permission }),
  setToken: (token) => set({ token }),
  setRegistering: (isRegistering) => set({ isRegistering }),
  reset: () => set({ permission: 'undetermined', token: null, isRegistering: false }),
}));
```

## register-device.ts —— expo-notifications 唯一接触点

```ts
// src/domain/notifications/register-device.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@api/logger';

import type { NotificationPermission } from './notification-store';

/**
 * 读取当前权限，不触发系统弹框。
 */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * 触发系统权限弹框（仅在 pre-permission 解释屏之后调用）。
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * 已授权时获取 device push token；未授权返回 null。
 * token 不在此上报后端，由 bridge 编排上报，便于去重。
 */
export async function getDevicePushToken(): Promise<string | null> {
  try {
    const permission = await getNotificationPermission();
    if (permission !== 'granted') return null;
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    return tokenResponse.data;
  } catch (error) {
    // token 获取失败不阻塞 App；记录后由下次启动重试。
    logger.warn('push.token_fetch_failed', { platform: Platform.OS });
    return null;
  }
}
```

## api/endpoints/notifications.ts —— token 上报 / 解绑

```ts
// src/api/endpoints/notifications.ts
import { apiClient } from '@api/client';
import { Platform } from 'react-native';

interface IRegisterPushTokenInput {
  token: string;
  locale: string;
  appVersion: string;
  buildNumber: string;
}

/**
 * 上报 push token 到后端；token 视为半敏感字段，logger 中已 redact。
 */
export async function registerPushToken(input: IRegisterPushTokenInput): Promise<void> {
  await apiClient.post('/notifications/devices', {
    token: input.token,
    platform: Platform.OS,
    locale: input.locale,
    appVersion: input.appVersion,
    buildNumber: input.buildNumber,
  });
}

/**
 * 用户登出时解绑当前 token 与 session 关联（best effort）。
 */
export async function unregisterPushToken(token: string): Promise<void> {
  await apiClient.delete(`/notifications/devices/${encodeURIComponent(token)}`);
}
```

## use-notification-handler.ts —— payload 解析 + 安全跳转

```ts
// src/domain/notifications/use-notification-handler.ts
import { useCallback } from 'react';
import type * as Notifications from 'expo-notifications';

import { logger } from '@api/logger';
import { isAllowedUrl } from '@domain/safe-url';
import { pushPath } from '@components/navigation/safe-navigate';

import { parsePushPayload, type IPushPayload } from './types';

/**
 * 处理点击通知后的业务分发与 deep link 跳转。
 * 返回的 handler 供 bridge 在前台 listener 与冷启动入口复用。
 */
export function useNotificationHandler() {
  const handlePayload = useCallback((payload: IPushPayload) => {
    // link 必须走 safe-url 白名单校验，拒绝白名单外地址。
    if (payload.link) {
      if (!isAllowedUrl(payload.link)) {
        logger.warn('push.link_rejected', { type: payload.type });
        return;
      }
      pushPath(payload.link);
      return;
    }

    // 未知 type 安全忽略，不抛错。
    switch (payload.type) {
      case 'message':
      case 'system_message':
      case 'entity_status_changed':
      case 'promo':
        logger.info('push.handled', { type: payload.type });
        break;
      default:
        logger.warn('push.unknown_type', { type: payload.type });
    }
  }, []);

  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const payload = parsePushPayload(response.notification.request.content.data);
      if (!payload) {
        logger.warn('push.payload_invalid');
        return;
      }
      handlePayload(payload);
    },
    [handlePayload],
  );

  return { handlePayload, handleResponse };
}
```

## push-notifications-bridge.tsx —— 编排入口

```tsx
// src/components/providers/push-notifications-bridge.tsx
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { useNotificationStore } from '@domain/notifications/notification-store';
import { useNotificationHandler } from '@domain/notifications/use-notification-handler';

/**
 * 前台收到通知的展示策略；也可改为 in-app banner 统一 UX。
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 推送编排桥：挂载点击 listener + 处理冷启动通知。
 * 不在此主动申请权限——权限在业务场景内带理由文案申请（见 useRequestNotification）。
 */
export function PushNotificationsBridge() {
  const { handleResponse } = useNotificationHandler();
  const setPermission = useNotificationStore((state) => state.setPermission);

  useEffect(() => {
    // 同步当前权限到 store，供 UI 决定是否展示 pre-permission 引导。
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setPermission(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
    });

    // 点击通知（前台 / 后台）跳转。
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // 冷启动：从通知打开 App。splash 隐藏后再 dispatch，避免与首屏冲突。
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    return () => responseSub.remove();
  }, [handleResponse, setPermission]);

  return null;
}
```

> 挂载位置：`app-providers.tsx` 中与 `AnalyticsBridge` / `QueryFocusBridge` 同层，置于 `SessionProvider` 之内（需要 session 才能上报 token）。

## 权限申请编排（业务场景内调用）

```ts
// src/domain/notifications/use-request-notification.ts
import { useCallback } from 'react';

import { useNotificationStore } from './notification-store';
import { getDevicePushToken, requestNotificationPermission } from './register-device';

/**
 * 在业务场景（如进入消息中心、开启通知偏好）展示理由文案后调用。
 * 不在 App 启动时调用——首次拒绝不可逆。
 */
export function useRequestNotification() {
  const { setPermission, setToken } = useNotificationStore.getState();

  return useCallback(async () => {
    const permission = await requestNotificationPermission();
    setPermission(permission);
    if (permission !== 'granted') return null;
    const token = await getDevicePushToken();
    setToken(token);
    return token; // 由调用方触发 registerPushToken 上报（带 locale / version）。
  }, [setPermission, setToken]);
}
```

## app.json 配置要点

```jsonc
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#000000",
        },
      ],
    ],
    "ios": { "infoPlist": { "UIBackgroundModes": ["remote-notification"] } },
    "android": { "permissions": ["POST_NOTIFICATIONS"] },
  },
}
```

## 测试模版

```ts
// src/test/domain/notifications/use-notification-handler.test.ts
import { renderHook } from '@testing-library/react-native';

import { useNotificationHandler } from '@domain/notifications/use-notification-handler';

const pushPathMock = jest.fn();
const isAllowedUrlMock = jest.fn();

jest.mock('@components/navigation/safe-navigate', () => ({
  pushPath: (href: string) => pushPathMock(href),
}));
jest.mock('@domain/safe-url', () => ({
  isAllowedUrl: (url: string) => isAllowedUrlMock(url),
}));

describe('useNotificationHandler', () => {
  beforeEach(() => {
    pushPathMock.mockReset();
    isAllowedUrlMock.mockReset();
  });

  it('navigates to a whitelisted deep link', () => {
    isAllowedUrlMock.mockReturnValue(true);
    const { result } = renderHook(() => useNotificationHandler());

    result.current.handlePayload({
      type: 'message',
      notificationId: 'n1',
      link: 'https://www.example.com/account/orders',
    });

    expect(pushPathMock).toHaveBeenCalledWith('https://www.example.com/account/orders');
  });

  it('rejects a link outside the whitelist', () => {
    isAllowedUrlMock.mockReturnValue(false);
    const { result } = renderHook(() => useNotificationHandler());

    result.current.handlePayload({ type: 'promo', notificationId: 'n2', link: 'https://evil.example' });

    expect(pushPathMock).not.toHaveBeenCalled();
  });

  it('ignores an invalid payload from a notification response', () => {
    const { result } = renderHook(() => useNotificationHandler());
    // @ts-expect-error 构造缺字段的非法 response
    result.current.handleResponse({ notification: { request: { content: { data: {} } } } });
    expect(pushPathMock).not.toHaveBeenCalled();
  });
});
```

> mock 约定：测试中 `jest.mock('expo-notifications')` 替换全部 API，不调真实 push 服务（见 `docs/rules/rn/testing.md` Mock 约定）。

## 注意点

- **唯一接触点**：仅 `register-device.ts` / `push-notifications-bridge.tsx` import `expo-notifications`；其余通过 store / hook 消费。需要时补架构测试守护该边界（参考 `image-boundary.test.ts` 风格）。
- **权限时机**：禁止启动即弹权限；在业务场景带理由文案后调 `useRequestNotification`。iOS 拒绝不可逆，只能引导 `Linking.openSettings()`。
- **token 安全**：token 是半敏感字段，logger 必须 redact；payload / token 上报中绝不含 secret。
- **deep link**：`link` 一律 `isAllowedUrl` / `assertAllowedUrl` 校验后再 `pushPath`，与普通 deep link 同一白名单。
- **三场景**：前台展示策略、点击跳转、冷启动 `getLastNotificationResponseAsync` 都要接入。
- **解绑**：登出时调 `unregisterPushToken` + `useNotificationStore.getState().reset()`。

## 完成检查

- 仅 bridge + `src/domain/notifications/*` 接触 `expo-notifications`，业务 screen 不直接调。
- 权限申请前有业务理由解释屏，未在启动时弹窗。
- token 上报后端 + 登出解绑 + 撤销授权清空本地 token。
- 推送 link 走 safe-url 白名单 + safe-navigate。
- 前台 / 后台 / 冷启动 handler 均接入。
- payload 经 `parsePushPayload` 守卫，未知 type 安全忽略。
