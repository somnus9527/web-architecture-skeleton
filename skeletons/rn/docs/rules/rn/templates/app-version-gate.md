# AppVersionGate 模版

> 上级规则：`docs/rules/rn/app-version-update.md`。

## 适用场景

启动时检测 native 版本是否需要更新，提示用户去应用商店。

## 模块结构

```
src/domain/app-version/
  store.ts            # zustand: latest / minimum / status / dismissed
  version-compare.ts  # SemVer 比较
  check.ts            # 调 endpoint + 缓存
  store-url.ts        # iOS / Android store deep link
  types.ts
src/api/endpoints/
  app-version.ts      # endpoint wrapper
src/components/providers/
  app-version-bridge.tsx  # 启动 + 前台时触发 check
src/components/app-update/
  app-version-gate.tsx
  force-update-modal.tsx
  suggested-update-banner.tsx
```

## types.ts

```ts
// src/domain/app-version/types.ts

export type UpdateStatus = 'unknown' | 'up-to-date' | 'suggested' | 'force';

export interface IAppVersionResult {
  latestVersion: string;
  minimumSupportedVersion: string;
  storeUrl: string;
  releaseNotes?: Record<string, string>;
  forceUpdateMessage?: Record<string, string>;
}
```

## version-compare.ts

```ts
// src/domain/app-version/version-compare.ts

/**
 * 比较两个 SemVer 字符串。返回 -1 / 0 / 1。
 *
 * 仅比较 major.minor.patch；预发布与 build 后缀忽略。
 *
 * @example
 * compareVersions('1.2.3', '1.10.0') === -1
 * compareVersions('2.0.0', '1.9.9') === 1
 * compareVersions('1.0.0', '1.0.0') === 0
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const partsB = b
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  for (let i = 0; i < 3; i += 1) {
    const x = partsA[i] ?? 0;
    const y = partsB[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * current 版本是否严格小于 target 版本。
 */
export function isVersionLowerThan(current: string, target: string): boolean {
  return compareVersions(current, target) < 0;
}
```

## store.ts

```ts
// src/domain/app-version/store.ts
import { create } from 'zustand';
import type { IAppVersionResult, UpdateStatus } from './types';

export interface IAppVersionState {
  current: string;
  latest: string;
  minimum: string;
  storeUrl: string;
  releaseNotes?: Record<string, string>;
  forceUpdateMessage?: Record<string, string>;
  status: UpdateStatus;
  /**
   * 用户在本次启动周期内已关闭过 suggested update 提示。
   * 强制更新不可 dismiss，此字段对 force 无效。
   */
  suggestedDismissed: boolean;
  lastCheckedAt: number | null;
  setVersionCheck: (
    input: Omit<IAppVersionState, 'suggestedDismissed' | 'setVersionCheck' | 'dismissSuggested' | 'resetForTest'>,
  ) => void;
  dismissSuggested: () => void;
  resetForTest: () => void;
}

export const useAppVersionStore = create<IAppVersionState>((set) => ({
  current: '0.0.0',
  latest: '0.0.0',
  minimum: '0.0.0',
  storeUrl: '',
  status: 'unknown',
  suggestedDismissed: false,
  lastCheckedAt: null,

  setVersionCheck: (input) => set({ ...input, suggestedDismissed: false }),
  dismissSuggested: () => set({ suggestedDismissed: true }),
  resetForTest: () =>
    set({
      current: '0.0.0',
      latest: '0.0.0',
      minimum: '0.0.0',
      storeUrl: '',
      status: 'unknown',
      suggestedDismissed: false,
      lastCheckedAt: null,
    }),
}));
```

## store-url.ts

```ts
// src/domain/app-version/store-url.ts
import { Platform } from 'react-native';

interface IStoreLink {
  primary: string;
  fallback: string;
}

/**
 * 从后端返回的 https store URL 派生 deep link。
 *
 * iOS：itms-apps:// 直接打开 App Store app；失败 fallback 到 https。
 * Android：market:// 直接打开 Play Store；失败 fallback 到 https。
 */
export function buildStoreDeepLink(httpsUrl: string): IStoreLink {
  if (Platform.OS === 'ios') {
    return {
      primary: httpsUrl.replace(/^https:/i, 'itms-apps:'),
      fallback: httpsUrl,
    };
  }
  if (Platform.OS === 'android') {
    const match = httpsUrl.match(/[?&]id=([^&]+)/);
    return {
      primary: match ? `market://details?id=${match[1]}` : httpsUrl,
      fallback: httpsUrl,
    };
  }
  return { primary: httpsUrl, fallback: httpsUrl };
}
```

## endpoint wrapper

```ts
// src/api/endpoints/app-version.ts
import { Platform } from 'react-native';
import { getJson, type ApiHelperOptions } from '@api/client';
import type { IAppVersionResult } from '@domain/app-version/types';

interface IApiEnvelope<TData> {
  code: string;
  message: string;
  data: TData;
}

/**
 * 读取当前平台的版本配置。
 */
export async function getAppVersionConfig(options: ApiHelperOptions = {}): Promise<IAppVersionResult> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const envelope = await getJson<IApiEnvelope<IAppVersionResult>>(`/api/app-version?platform=${platform}`, options);
  return envelope.data;
}
```

## check.ts

```ts
// src/domain/app-version/check.ts
import * as Application from 'expo-application';
import { logger } from '@api/logger';
import { getAppVersionConfig } from '@api/endpoints/app-version';

import { useAppVersionStore } from './store';
import { compareVersions, isVersionLowerThan } from './version-compare';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * 检查版本。force=true 跳过缓存。
 */
export async function checkAppVersion(force = false): Promise<void> {
  const state = useAppVersionStore.getState();

  if (!force && state.lastCheckedAt && Date.now() - state.lastCheckedAt < CACHE_TTL_MS) {
    return;
  }

  const current = Application.nativeApplicationVersion ?? '0.0.0';

  try {
    const result = await getAppVersionConfig();
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
    logger.warn('app_version_check_failed', { error });
    // 失败时保留上次结果；不阻塞应用
  }
}
```

## app-version-bridge.tsx

```tsx
// src/components/providers/app-version-bridge.tsx
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { checkAppVersion } from '@domain/app-version/check';

/**
 * 启动时 + 前台恢复时检查 App 版本。第 8 层桥接组件。
 */
export function AppVersionBridge() {
  useEffect(() => {
    void checkAppVersion();

    function handle(state: AppStateStatus) {
      if (state === 'active') void checkAppVersion();
    }

    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, []);

  return null;
}
```

## Gate + 两种 UI

```tsx
// src/components/app-update/app-version-gate.tsx
import { type ReactNode } from 'react';
import { useAppVersionStore } from '@domain/app-version/store';

import { ForceUpdateModal } from './force-update-modal';
import { SuggestedUpdateBanner } from './suggested-update-banner';

/**
 * 包裹业务子树，按 status 渲染 force / suggested 提示。
 */
export function AppVersionGate({ children }: { children: ReactNode }) {
  const status = useAppVersionStore((s) => s.status);
  const suggestedDismissed = useAppVersionStore((s) => s.suggestedDismissed);

  if (status === 'force') {
    return <ForceUpdateModal />;
  }

  return (
    <>
      {status === 'suggested' && !suggestedDismissed && <SuggestedUpdateBanner />}
      {children}
    </>
  );
}
```

```tsx
// src/components/app-update/force-update-modal.tsx
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { Button } from '@components/ui/button';
import { useAppVersionStore } from '@domain/app-version/store';
import { buildStoreDeepLink } from '@domain/app-version/store-url';
import { useLocaleStore } from '@domain/locale/locale-store';
import { useThemeTokens } from '@theme/theme-provider';

/**
 * 强制更新 modal。不可关闭、不可滑动消失。
 */
export function ForceUpdateModal() {
  const tokens = useThemeTokens();
  const { t } = useTranslation();
  const { storeUrl, forceUpdateMessage } = useAppVersionStore();
  const locale = useLocaleStore((s) => s.locale);

  const localizedMessage = forceUpdateMessage?.[locale] ?? forceUpdateMessage?.en;

  async function handleUpdate() {
    const { primary, fallback } = buildStoreDeepLink(storeUrl);
    const canOpen = await Linking.canOpenURL(primary);
    await Linking.openURL(canOpen ? primary : fallback);
  }

  return (
    <Modal animationType="fade" transparent={false} visible>
      <View style={[styles.container, { backgroundColor: tokens.colors.surface, padding: tokens.spacing.xl }]}>
        <ScrollView contentContainerStyle={{ gap: tokens.spacing.md }}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: tokens.colors.textPrimary, fontSize: tokens.typography.title }]}
          >
            {t('appUpdate.force.title')}
          </Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.body }}>
            {localizedMessage ?? t('appUpdate.force.description')}
          </Text>
          <Button label={t('appUpdate.force.action')} onPress={handleUpdate} testID="force-update-action" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: { fontWeight: '700', textAlign: 'center' },
});
```

```tsx
// src/components/app-update/suggested-update-banner.tsx
import { StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { Button } from '@components/ui/button';
import { useAppVersionStore } from '@domain/app-version/store';
import { buildStoreDeepLink } from '@domain/app-version/store-url';
import { useThemeTokens } from '@theme/theme-provider';

/**
 * 建议更新 banner。可关闭，本次启动不再提示。
 */
export function SuggestedUpdateBanner() {
  const tokens = useThemeTokens();
  const { t } = useTranslation();
  const { latest, storeUrl, dismissSuggested } = useAppVersionStore();

  async function handleUpdate() {
    const { primary, fallback } = buildStoreDeepLink(storeUrl);
    const canOpen = await Linking.canOpenURL(primary);
    await Linking.openURL(canOpen ? primary : fallback);
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.surfaceHighlight, padding: tokens.spacing.md }]}>
      <View style={[styles.row, { gap: tokens.spacing.sm }]}>
        <View style={{ flex: 1, gap: tokens.spacing.xs }}>
          <Text style={{ color: tokens.colors.textPrimary, fontWeight: '600' }}>{t('appUpdate.suggested.title')}</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.caption }}>
            {t('appUpdate.suggested.description', { latestVersion: latest })}
          </Text>
        </View>
        <View style={{ gap: tokens.spacing.xs }}>
          <Button label={t('appUpdate.suggested.update')} onPress={handleUpdate} testID="suggested-update-action" />
          <Button
            label={t('appUpdate.suggested.later')}
            variant="ghost"
            onPress={dismissSuggested}
            testID="suggested-update-dismiss"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

## 挂载

```tsx
// src/components/providers/app-providers.tsx 内
export function AppProviders({ children }: IAppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... 其他 Provider ... */}
      <ToastProvider>
        <AppVersionBridge /> {/* 桥接：触发检查 */}
        {/* 其他 bridges ... */}
        <AppVersionGate>
          {' '}
          {/* Gate：渲染 force / suggested UI */}
          {children}
        </AppVersionGate>
        <ToastViewport />
      </ToastProvider>
      {/* ... */}
    </QueryClientProvider>
  );
}
```

## i18n 文案 Key

```
appUpdate.force.title              # "需要更新"
appUpdate.force.description        # "此版本已不再支持，请更新到最新版本。"
appUpdate.force.action             # "立即更新"
appUpdate.suggested.title          # "新版本可用"
appUpdate.suggested.description    # "{{latestVersion}} 已发布。"
appUpdate.suggested.update         # "立即更新"
appUpdate.suggested.later          # "稍后"
```

## 测试

```ts
// src/test/domain/app-version/version-compare.test.ts
import { compareVersions } from '@domain/app-version/version-compare';

describe('compareVersions', () => {
  it.each([
    ['1.2.3', '1.10.0', -1],
    ['2.0.0', '1.9.9', 1],
    ['1.0.0', '1.0.0', 0],
    ['1.0.0-beta', '1.0.0', 0],
    ['10.0.0', '9.99.99', 1],
  ])('compareVersions(%s, %s) === %d', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});
```

```ts
// src/test/domain/app-version/check.test.ts
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));
jest.mock('@api/endpoints/app-version');

describe('checkAppVersion', () => {
  it('marks status as force when below minimum', async () => {
    (getAppVersionConfig as jest.Mock).mockResolvedValue({
      latestVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      storeUrl: 'https://apps.apple.com/app/idXXX',
    });

    await checkAppVersion(true);

    expect(useAppVersionStore.getState().status).toBe('force');
  });

  it('marks status as suggested when below latest but above minimum', async () => {
    (getAppVersionConfig as jest.Mock).mockResolvedValue({
      latestVersion: '1.2.0',
      minimumSupportedVersion: '0.9.0',
      storeUrl: 'https://apps.apple.com/app/idXXX',
    });

    await checkAppVersion(true);

    expect(useAppVersionStore.getState().status).toBe('suggested');
  });

  it('does not refetch within cache TTL', async () => {
    useAppVersionStore.setState({ lastCheckedAt: Date.now() });
    await checkAppVersion(false);
    expect(getAppVersionConfig).not.toHaveBeenCalled();
  });
});
```
