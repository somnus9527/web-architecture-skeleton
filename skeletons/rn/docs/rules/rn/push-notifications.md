# 推送通知规则

## 目的

本文件描述 React Native 应用接入与使用 push notification（远程推送）的规则，包括权限申请、token 管理、payload 协议、deep link 联动、前后台行为与隐私合规。

完整落地代码（bridge / store / handler / endpoint / 测试）见 `docs/rules/rn/templates/push-notifications-bridge.md`。

## 依赖与抽象

- 使用 Expo 生态的 `expo-notifications` 作为统一接入层（最新稳定版）。
- iOS push 走 APNs，Android 走 FCM；`expo-notifications` 封装平台差异，开发者只面对统一 API。
- 不直接 import `@react-native-firebase/messaging`、`react-native-push-notification` 等历史方案；除非 `expo-notifications` 不能覆盖需求并经 ADR 决策。

## 接入位置

- 入口逻辑放在 `src/components/providers/push-notifications-bridge.tsx`（命名遵循 `<area>-bridge.tsx`）。
- 业务 screen 不直接调用 `expo-notifications`；通过 `@domain/notifications` 包装的 hook 与 store 消费。

```
src/
  components/providers/push-notifications-bridge.tsx   # 权限申请 + token 注册 + listener
  domain/notifications/
    store.ts                                            # token / permission state
    types.ts                                            # payload schema
    use-notification-handler.ts                        # 处理 payload 与 deep link
```

## 权限申请时机

### 原则

- **不在 App 启动时立即弹权限**：用户对 App 还无认知，拒绝率高且不可逆。
- 在用户进入需要通知的场景前申请，附**业务理由文案**：
  - 完成关键提交进入详情 → "我们将通过通知告知您后续状态"。
  - 进入消息中心 → "开启通知接收新消息"。
  - 用户主动开启"通知偏好"开关 → 引导到系统设置授权。

### iOS

- `expo-notifications.requestPermissionsAsync()` 触发系统弹框。
- 用户拒绝后，App 内不能再次触发弹框；只能引导去 Settings 手动开启（`Linking.openSettings()`）。
- 因此首次弹框前 App 内必须有 pre-permission 解释屏。

### Android

- Android 13+（API 33+）需要 `POST_NOTIFICATIONS` runtime permission；同样调 `requestPermissionsAsync`。
- Android 12 及以下默认允许通知，但用户可在系统设置关闭。

## Token 管理

### 获取与注册

```ts
import * as Notifications from 'expo-notifications';

async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  // 或 Expo push token：await Notifications.getExpoPushTokenAsync({ projectId });

  return tokenResponse.data;
}
```

### 上报后端

- token 通过 endpoint wrapper（`src/api/endpoints/notifications.ts`）注册到后端。
- 上报字段：token、platform（`ios` / `android`）、locale、app version、build number。
- token 变化时（应用首次开启 / 用户切换账号 / 系统重置）重新上报。

### 存储

- token 不属于 secret；可存 AsyncStorage 用于"判断是否需要重新上报"。
- 详见 `docs/rules/rn/storage.md`。

### 解绑

- 用户登出时通知后端解绑当前 token + session identity 的关联。
- 用户卸载 App 时无法主动解绑；后端依赖 push 失败回调清理。

## Payload 协议

### 统一 schema

约定后端推送的 `data` 字段为 JSON 对象，含：

```ts
interface IPushPayload {
  /**
   * 业务事件类型；前端按 type 分发。
   */
  type: 'entity_status_changed' | 'system_message' | 'promo' | 'message' | ...;
  /**
   * Deep link 路径；前端跳转使用。
   */
  link?: string;
  /**
   * 业务数据；前端按 type 解析。
   */
  data?: Record<string, unknown>;
  /**
   * 通知 ID，用于去重与已读上报。
   */
  notificationId: string;
}
```

### Title / Body

- 后端推送时填 `title` 与 `body`，按用户 locale 渲染。
- 不在前端解析 title / body（除非业务必须本地化）。

## 前台与后台行为

### 前台收到通知

默认 iOS 不显示系统通知；需要配置：

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

或前台收到通知时改用 in-app banner（统一 UX）。

### 点击通知跳转

```ts
Notifications.addNotificationResponseReceivedListener((response) => {
  const payload = response.notification.request.content.data as IPushPayload;
  if (payload.link) {
    // 通过 safe-url + safe-navigate 校验后跳转
    pushPath(payload.link);
  }
});
```

- link 必须走 `@domain/safe-url` 白名单校验（详见 `docs/rules/rn/security.md`）。
- 跳转使用 `@components/navigation/safe-navigate.pushPath`（详见 `docs/rules/rn/routing.md`）。

### 冷启动从通知打开

```ts
const lastResponse = await Notifications.getLastNotificationResponseAsync();
if (lastResponse) {
  // 在 splash 隐藏后再 dispatch link，避免与首屏冲突
}
```

## 角标（Badge）

- iOS / Android：通过 `Notifications.setBadgeCountAsync(count)` 设置。
- 后端推送时携带 `badge` 数字；前端按业务清零（如进入消息列表后调 `setBadgeCountAsync(0)`）。

## Deep Link 联动

- 推送 `link` 字段格式必须与 `app.json:scheme` 或 universal link 一致。
- 推送 link 校验流程与普通 deep link 一致：`@domain/safe-url.assertAllowedUrl` → `safe-navigate.pushPath`。
- 详见 `docs/rules/rn/security.md`。

## 频次与节流

- 同类业务通知（如 promo）不允许 1 天内推送超过 1 次；后端负责。
- 用户偏好"消息中心 / 营销活动 / 系统通知"分类开关；前端通过 endpoint 上报偏好。

## 隐私与合规

### 用户授权前

- 不收集 push token。
- 不调 `requestPermissionsAsync` 之前不展示 pre-permission 弹窗（除非用户明确进入"消息设置"）。

### 用户授权后

- 上报后端的 token 视为半敏感字段：logger 中 redact。
- 不在 push payload 中传敏感字段（订单完整金额可以，密码 / token 绝不）。

### 用户撤销授权

- 检测 `permissions.status === 'denied'` 时清空本地 token。
- 通知后端解绑（best effort）。

## 测试

- 测试中 mock `expo-notifications` 全部 API；不调真实 push 服务。
- 关键 hook（`useNotificationHandler`）覆盖：收到 payload 后跳转 / 拒绝白名单外 link / 处理未知 type。

## 完成检查

- 仅 `src/components/providers/push-notifications-bridge.tsx` 与 `src/domain/notifications/*` 调 `expo-notifications`；业务 screen 不直接调。
- 权限申请前有业务理由解释屏。
- Token 上报后端 + 用户登出时解绑。
- 推送 link 走 safe-url + safe-navigate。
- 前台 / 后台 / 冷启动三种场景的 handler 都接入。
- 不在 payload / token 上报中泄漏 secret。
