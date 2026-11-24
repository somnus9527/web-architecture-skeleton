# 应用版本更新规则

## 目的

在未引入 OTA 的阶段，本规则定义"如何检测新 App 版本可用并引导用户去应用商店更新"的最小可用方案。

## 适用范围

- 应用通过 App Store / Play Store 分发；不依赖 OTA / EAS Update。
- 后端能提供版本接口（必须，否则规则不成立）。
- OTA 接入后，本规则仍适用于"native binary 必须新装"的场景。

## 总体设计

```
启动 / 前台恢复
  └─ AppVersionBridge.check()
       ├─ 读 expo-application 拿 current version + buildNumber
       ├─ GET /api/app-version → { latestVersion, minimumSupportedVersion, storeUrl }
       ├─ 缓存 24h 结果
       └─ 比较 SemVer：
            ├─ current < minimumSupportedVersion → 阻塞 modal
            ├─ current < latestVersion           → 建议 banner / 可关闭 modal
            └─ current >= latestVersion          → 不显示
```

## 依赖

- `expo-application`（最新稳定版）：读 app version、build number。
- `expo-linking`（已有）：打开应用商店 URL。
- 业务代码不直接 import 上述包；通过 `@domain/app-version/*` 消费。

## 后端契约

### 接口

```
GET /api/app-version?platform=ios|android
```

### 响应

```json
{
  "code": "0",
  "data": {
    "latestVersion": "1.2.0",
    "minimumSupportedVersion": "1.0.0",
    "storeUrl": "https://apps.apple.com/app/idXXXXXXXXX",
    "releaseNotes": {
      "en": "Bug fixes and improvements.",
      "zh": "修复问题并提升体验。"
    },
    "forceUpdateMessage": {
      "en": "This version is no longer supported. Please update.",
      "zh": "此版本已停止支持，请更新。"
    }
  }
}
```

字段说明：

| 字段                      | 必填 | 说明                                    |
| ------------------------- | ---- | --------------------------------------- |
| `latestVersion`           | 是   | 商店当前最新版本（SemVer）              |
| `minimumSupportedVersion` | 是   | 强制更新阈值；用户当前版本 < 该值时阻塞 |
| `storeUrl`                | 是   | iOS / Android 各自的商店 URL            |
| `releaseNotes`            | 否   | 多语言更新内容                          |
| `forceUpdateMessage`      | 否   | 强制更新文案；缺省使用项目兜底 i18n     |

### 缓存

- 客户端缓存 24 小时（AsyncStorage key `<app-namespace>.app-version-check`），减少请求频次。
- 缓存过期 / 应用版本变化 / 强制重置时重新请求。
- 网络失败时使用上次缓存结果；缓存也不存在时本次跳过检查（不阻塞应用使用）。

## 客户端实现

### 模块组织

```
src/domain/app-version/
  store.ts             # zustand: 当前 latest / minimum / 已提示
  version-compare.ts   # SemVer 比较
  check.ts             # 调 endpoint + 缓存
  store-url.ts         # 平台 store URL 生成
  types.ts
src/components/providers/
  app-version-bridge.tsx  # 启动 + AppState change 时 trigger check
src/components/app-update/
  force-update-modal.tsx
  suggested-update-banner.tsx
```

### SemVer 比较

```ts
// src/domain/app-version/version-compare.ts

/**
 * 比较两个 SemVer 字符串。返回 -1 / 0 / 1。
 *
 * 仅比较 major.minor.patch；预发布 / build 后缀忽略。
 *
 * compareVersions('1.2.3', '1.10.0')  → -1
 * compareVersions('2.0.0', '1.9.9')   → 1
 * compareVersions('1.0.0', '1.0.0')   → 0
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('-')[0].split('.').map(Number);
  const partsB = b.split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const x = partsA[i] ?? 0;
    const y = partsB[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function isVersionLowerThan(current: string, target: string): boolean {
  return compareVersions(current, target) < 0;
}
```

**禁止用字符串直接比较**（`'1.10.0' < '1.9.0'` 字符串比较为 true，但 SemVer 应是 false）。

### Store URL

```ts
// src/domain/app-version/store-url.ts
import { Platform } from 'react-native';

/**
 * 从后端返回的 storeUrl 与本地 App ID 生成深层链接。
 *
 * iOS 优先尝试 itms-apps:// scheme（直接打开 App Store app），
 * 失败 fallback 到 https URL。
 *
 * Android 优先 market:// scheme，失败 fallback 到 https URL。
 */
export function buildStoreDeepLink(httpsUrl: string): { primary: string; fallback: string } {
  if (Platform.OS === 'ios') {
    return {
      primary: httpsUrl.replace(/^https:/, 'itms-apps:'),
      fallback: httpsUrl,
    };
  }
  if (Platform.OS === 'android') {
    // 从 https://play.google.com/store/apps/details?id=com.example 提取 package
    const match = httpsUrl.match(/[?&]id=([^&]+)/);
    return {
      primary: match ? `market://details?id=${match[1]}` : httpsUrl,
      fallback: httpsUrl,
    };
  }
  return { primary: httpsUrl, fallback: httpsUrl };
}
```

### Check 流程

```ts
// src/domain/app-version/check.ts
import * as Application from 'expo-application';
import { isVersionLowerThan } from './version-compare';
import { useAppVersionStore } from './store';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function checkAppVersion(force = false): Promise<void> {
  const state = useAppVersionStore.getState();
  if (!force && state.lastCheckedAt && Date.now() - state.lastCheckedAt < CACHE_TTL_MS) {
    return;
  }

  const current = Application.nativeApplicationVersion ?? '0.0.0';

  try {
    const result = await getAppVersionFromBackend();
    const status = isVersionLowerThan(current, result.minimumSupportedVersion)
      ? 'force'
      : isVersionLowerThan(current, result.latestVersion)
        ? 'suggested'
        : 'up-to-date';

    state.setVersionCheck({
      current,
      latest: result.latestVersion,
      minimum: result.minimumSupportedVersion,
      storeUrl: result.storeUrl,
      releaseNotes: result.releaseNotes,
      forceUpdateMessage: result.forceUpdateMessage,
      status,
      lastCheckedAt: Date.now(),
    });
  } catch (error) {
    // 网络 / 后端失败：本次跳过，下次再试
    logger.warn('app_version_check_failed', { error });
  }
}
```

### Bridge

```tsx
// src/components/providers/app-version-bridge.tsx
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { checkAppVersion } from '@domain/app-version/check';

export function AppVersionBridge() {
  useEffect(() => {
    void checkAppVersion();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkAppVersion();
    });
    return () => sub.remove();
  }, []);

  return null;
}
```

挂在 root provider 组合器的第 8 层（桥接 / 监听）。

### UI 触发

```tsx
// src/components/providers/app-providers.tsx 内（或子组件）
function AppVersionGate({ children }: { children: ReactNode }) {
  const status = useAppVersionStore((s) => s.status);

  if (status === 'force') {
    return <ForceUpdateModal />;
  }

  return (
    <>
      {status === 'suggested' && <SuggestedUpdateBanner />}
      {children}
    </>
  );
}
```

### Force Update Modal

- 全屏阻塞 modal，不可关闭、不可滑动消失。
- 显示 release notes（若有）。
- "立即更新" 按钮 → 跳商店。
- 不提供 "取消" / "稍后" / "退出"。

### Suggested Update Banner

- 顶部 banner 或顶层 modal，可关闭。
- 用户关闭后**本次启动周期内不再提示**（store 中记 `dismissed: true`）；下次启动重新检查。
- "立即更新" 按钮 → 跳商店。
- "稍后" 按钮 → 关闭 banner。

### 跳转商店

```ts
import * as Linking from 'expo-linking';
import { buildStoreDeepLink } from '@domain/app-version/store-url';

async function openStore(storeUrl: string): Promise<void> {
  const { primary, fallback } = buildStoreDeepLink(storeUrl);
  const canOpenPrimary = await Linking.canOpenURL(primary);
  await Linking.openURL(canOpenPrimary ? primary : fallback);
}
```

不走 `@components/native-actions.openUrlWithFailureToast`，因为 `itms-apps://` / `market://` 不在 `safe-url` 默认白名单内；可以扩 `ALLOWED_PROTOCOLS` 加入这两个 scheme，或在 store-url helper 内直接调 Linking。

## i18n 文案

```
appUpdate.force.title         # "需要更新"
appUpdate.force.description   # "此版本已不再支持，请更新到最新版本。"
appUpdate.force.action        # "立即更新"
appUpdate.suggested.title     # "新版本可用"
appUpdate.suggested.description  # "{{latestVersion}} 已发布。"
appUpdate.suggested.update    # "立即更新"
appUpdate.suggested.later     # "稍后"
```

## 完成检查

- 后端接口与契约一致；platform 区分 iOS / Android。
- SemVer 比较使用语义化解析；不字符串比较。
- 启动 + 前台恢复时检查；24h 缓存避免高频。
- 强制更新阻塞 modal；建议更新可关闭。
- 商店 deep link 优先 `itms-apps:` / `market:`，失败 fallback https。
- 缓存 / 失败路径不阻塞应用使用。
- i18n 文案完整。
- 不依赖 OTA 与第三方 SDK。

## 与 OTA 衔接（未来）

OTA 接入后：

- 本规则**继续生效**：OTA 不替代 native binary 更新；当 native 改动（new dep / new permission）时仍需用户从商店更新。
- `minimumSupportedVersion` 仍然是 native binary 维度，不是 JS bundle runtime version。
- 启动检查顺序：先 native version → 再 OTA update（先确保 binary 兼容，再考虑 JS bundle 升级）。
