# Native Action Helper 模版

> 上级规则：`docs/rules/rn/native-actions.md`、`docs/rules/rn/security.md`、`docs/rules/rn/error-handling.md`。
>
> 建议落地位置：`src/components/native-actions.ts`。

## 适用场景

剪贴板、外部浏览器、系统外链、分享等 native 动作的统一封装。

## 完整模版

```ts
// src/components/native-actions.ts
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Share, type ShareContent } from 'react-native';

import { assertAllowedUrl } from '@domain/safe-url';
import { logger } from '@api/logger';
import type { ToastVariant } from '@domain/toast/toast-provider';

/**
 * Native action helper 使用的 toast 派发函数签名。
 */
export type NativeActionToastDispatcher = (toast: { title: string; variant: ToastVariant }) => void;

/**
 * Native 动作失败时的本地化反馈。
 */
export interface INativeActionFailureFeedback {
  /**
   * 失败 toast 标题，必须由调用侧传入本地化文案。
   */
  title: string;
  /**
   * 失败 toast 语义，默认按 error 处理。
   */
  variant?: ToastVariant;
  /**
   * 派发全局 toast 的函数。
   */
  pushToast: NativeActionToastDispatcher;
}

/**
 * 派发 native 动作失败 toast。
 */
function pushNativeActionFailureToast(feedback: INativeActionFailureFeedback): void {
  feedback.pushToast({
    title: feedback.title,
    variant: feedback.variant ?? 'error',
  });
}

/**
 * 复制文本到剪贴板，失败时立即展示 toast 反馈。
 *
 * @param value 需要写入剪贴板的文本。
 * @param failureFeedback 剪贴板写入失败时的本地化反馈。
 * @returns 写入成功时返回 true，失败时返回 false。
 */
export async function copyTextWithFailureToast(
  value: string,
  failureFeedback: INativeActionFailureFeedback,
): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch (error) {
    logger.warn('clipboard_copy_failed', { error });
    pushNativeActionFailureToast(failureFeedback);
    return false;
  }
}

/**
 * 用 Expo WebBrowser 打开外部链接。URL 必须先经过 safe-url 校验。
 *
 * @param url 需要打开的外部链接。
 * @param failureFeedback 外部浏览器打开失败时的本地化反馈。
 * @returns 打开成功时返回 WebBrowser 结果，失败时返回 null。
 */
export async function openBrowserWithFailureToast(
  url: string,
  failureFeedback: INativeActionFailureFeedback,
): Promise<WebBrowser.WebBrowserResult | null> {
  try {
    assertAllowedUrl(url);
    return await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    logger.warn('open_browser_failed', { url, error });
    pushNativeActionFailureToast(failureFeedback);
    return null;
  }
}

/**
 * 用 RN Linking 打开系统外链（mailto、tel、custom scheme）。URL 必须先经过 safe-url 校验。
 *
 * @param url 系统外链。
 * @param failureFeedback 系统外链打开失败时的本地化反馈。
 * @returns 打开成功时返回 true，失败时返回 false。
 */
export async function openUrlWithFailureToast(
  url: string,
  failureFeedback: INativeActionFailureFeedback,
): Promise<boolean> {
  try {
    assertAllowedUrl(url);
    await Linking.openURL(url);
    return true;
  } catch (error) {
    logger.warn('open_url_failed', { url, error });
    pushNativeActionFailureToast(failureFeedback);
    return false;
  }
}

/**
 * 打开系统分享面板，失败时立即展示 toast 反馈。
 *
 * @param content 系统分享内容（message + 可选 url）。
 * @param failureFeedback 分享面板打开失败时的本地化反馈。
 * @returns 分享成功打开时返回 Share 结果，失败时返回 null。
 */
export async function shareWithFailureToast(
  content: ShareContent,
  failureFeedback: INativeActionFailureFeedback,
): Promise<Awaited<ReturnType<typeof Share.share>> | null> {
  try {
    return await Share.share(content);
  } catch (error) {
    logger.warn('share_failed', { error });
    pushNativeActionFailureToast(failureFeedback);
    return null;
  }
}
```

## Safe URL 校验

`@domain/safe-url`：

```ts
// src/domain/safe-url.ts
const ALLOWED_PROTOCOLS = new Set(['https:', 'mailto:', 'tel:', '<app-scheme>:']);
const ALLOWED_HOSTS = new Set(['www.example.com', 'support.example.com', 'cdn.example.com']);

/**
 * 判断 URL 是否在白名单内。
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    if (parsed.protocol === 'https:' && !ALLOWED_HOSTS.has(parsed.host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验 URL；不在白名单时 throw。
 */
export function assertAllowedUrl(url: string): void {
  if (!isAllowedUrl(url)) {
    throw new Error(`URL not allowed: ${url}`);
  }
}
```

## 在组件中使用

```tsx
import { copyTextWithFailureToast, openBrowserWithFailureToast } from '@components/native-actions';
import { useAppToast } from '@domain/toast/toast-provider';
import { useTranslation } from 'react-i18next';

function FeatureItemCard({ item }: { item: IFeatureItem }) {
  const pushToast = useAppToast();
  const { t } = useTranslation();

  async function handleCopyCode() {
    const success = await copyTextWithFailureToast(item.code, {
      title: t('feature.copy.failed'),
      pushToast,
    });

    if (success) {
      pushToast({ title: t('feature.copy.success'), variant: 'info' });
    }
  }

  async function handleOpenGuide() {
    await openBrowserWithFailureToast(item.guideUrl, {
      title: t('feature.openGuide.failed'),
      pushToast,
    });
  }

  return (
    <Card>
      <Button label={t('feature.copy.label')} onPress={handleCopyCode} />
      <Button label={t('feature.openGuide.label')} onPress={handleOpenGuide} variant="ghost" />
    </Card>
  );
}
```

## 注意点

- **URL 校验**：`openBrowser` / `openUrl` 都在 helper 内调 `assertAllowedUrl`。
- **失败必 toast**：任何失败都派发 toast，不静默吞掉。
- **成功反馈**：剪贴板等"用户感知弱"的动作成功时也 push 成功 toast。
- **logger.warn**：失败同时记日志，便于 debug。
- **不在 helper 内做 i18n**：toast 文案由调用方传入；helper 只负责动作 + 反馈派发。
- **业务代码不直接 import**：业务代码必须用 helper，不直接 `Clipboard.setStringAsync` 等。

## 测试模版

```ts
// src/test/components/native-actions.test.ts
import { copyTextWithFailureToast, openBrowserWithFailureToast } from '@components/native-actions';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

jest.mock('expo-clipboard');
jest.mock('expo-web-browser');
jest.mock('@domain/safe-url', () => ({
  assertAllowedUrl: jest.fn(),
  isAllowedUrl: jest.fn().mockReturnValue(true),
}));

describe('copyTextWithFailureToast', () => {
  it('returns true on success', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);
    const pushToast = jest.fn();
    const result = await copyTextWithFailureToast('abc', { title: 'Failed', pushToast });
    expect(result).toBe(true);
    expect(pushToast).not.toHaveBeenCalled();
  });

  it('pushes toast and returns false on failure', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    const pushToast = jest.fn();
    const result = await copyTextWithFailureToast('abc', { title: 'Failed', pushToast });
    expect(result).toBe(false);
    expect(pushToast).toHaveBeenCalledWith({ title: 'Failed', variant: 'error' });
  });
});

describe('openBrowserWithFailureToast', () => {
  it('rejects URL not in whitelist', async () => {
    const { assertAllowedUrl } = require('@domain/safe-url');
    assertAllowedUrl.mockImplementation(() => {
      throw new Error('blocked');
    });
    const pushToast = jest.fn();
    const result = await openBrowserWithFailureToast('https://evil.com', {
      title: 'Open failed',
      pushToast,
    });
    expect(result).toBeNull();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalled();
  });
});
```
