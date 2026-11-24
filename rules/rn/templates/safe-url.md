# Safe URL 模版

> 上级规则：`docs/rules/rn/security.md`、`docs/rules/rn/native-actions.md`、`docs/rules/rn/routing.md`。

## 适用场景

所有外部 URL（打开浏览器、deep link、推送 link、WebView source）的统一校验入口。

## 完整模版

```ts
// src/domain/safe-url.ts

/**
 * 允许的协议白名单。
 *
 * - https:  普通外部链接、API
 * - mailto: 邮件
 * - tel:    电话
 * - <app>:  自有 deep link scheme，由 app.json:scheme 决定
 */
const ALLOWED_PROTOCOLS: readonly string[] = [
  'https:',
  'mailto:',
  'tel:',
  // App 自有 scheme 通过环境配置注入，避免硬编码到规则文件
  // 例如：'<app-namespace>:'
];

/**
 * 允许的 HTTPS host 白名单。
 *
 * 通常由后端 / 运维明确给出。开发期可以宽松，发布前必须收紧。
 */
const ALLOWED_HOSTS: readonly string[] = [
  // 'www.example.com',
  // 'cdn.example.com',
  // 'support.example.com',
  // 'trusted.example.com',
];

/**
 * 允许的 HTTPS host 后缀（覆盖 CDN 多子域）。
 *
 * 例如 'cdn.example.com' 已在 hosts 列表，'*.cdn.example.com' 通过后缀匹配。
 */
const ALLOWED_HOST_SUFFIXES: readonly string[] = [
  // '.cdn.example.com',
];

/**
 * 判断 URL 是否在白名单内。失败时返回 false（不 throw）。
 */
export function isAllowedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // 协议白名单
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return false;
  }

  // HTTPS 必须 host 在白名单
  if (parsed.protocol === 'https:') {
    const host = parsed.host.toLowerCase();
    if (ALLOWED_HOSTS.includes(host)) return true;
    if (ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
    return false;
  }

  // mailto: / tel: / app scheme 通过
  return true;
}

/**
 * 判断是否为允许的图片 URL（允许更宽松：CDN host + 任意 https）。
 * 业务方按需调整。
 */
export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  // 图片可能来自任意 CDN，规则可以放宽；但必须 https。
  // 如果业务需要严格控制图片来源，使用 ALLOWED_IMAGE_HOSTS 单独白名单。
  return true;
}

/**
 * 校验 URL；不在白名单时 throw。用于必须拒绝的入口（deep link、external browser）。
 */
export function assertAllowedUrl(url: string): void {
  if (!isAllowedUrl(url)) {
    throw new Error(`URL not allowed: ${url}`);
  }
}

/**
 * 解析自有 scheme deep link 的路径与 query。
 *
 * 例如 'myapp://external/return?requestId=req-1' 返回
 * { pathname: '/pay/return', searchParams: URLSearchParams }。
 */
export interface IParsedAppLink {
  pathname: string;
  searchParams: URLSearchParams;
}

export function parseAppLink(url: string, appScheme: string): IParsedAppLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${appScheme}:`) {
    return null;
  }

  return {
    pathname: parsed.pathname || `/${parsed.hostname}`,
    searchParams: parsed.searchParams,
  };
}
```

## 配置注入

App scheme 与 host 白名单不应硬编码到 `safe-url.ts`。建议：

- App scheme：从 `app.json:expo.scheme` 读取，由构建脚本注入到 `safe-url` 模块；
- Host 白名单：维护在独立 `src/domain/safe-url-config.ts`，便于业务方独立修改：

```ts
// src/domain/safe-url-config.ts
export const APP_DEEP_LINK_SCHEME = '<app-namespace>';

export const ALLOWED_EXTERNAL_HOSTS: readonly string[] = ['www.example.com', 'support.example.com'];

export const ALLOWED_EXTERNAL_HOST_SUFFIXES: readonly string[] = ['.example.com'];
```

`safe-url.ts` 从 config 文件 import 这些常量。这样：

- 规则代码（safe-url.ts）保持稳定。
- 业务方修改白名单只动 config。
- 测试中可 mock config 文件。

## 使用场景

### Native action（外部浏览器）

```ts
import { assertAllowedUrl } from '@domain/safe-url';

export async function openBrowserWithFailureToast(url: string, feedback: INativeActionFailureFeedback) {
  try {
    assertAllowedUrl(url);
    return await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    logger.warn('open_browser_failed', { url, error });
    feedback.pushToast({ title: feedback.title, variant: 'error' });
    return null;
  }
}
```

### Deep link 入口

```tsx
// src/components/navigation/deep-link-bridge.tsx
import { Linking } from 'react-native';
import { useEffect } from 'react';
import { isAllowedUrl, parseAppLink } from '@domain/safe-url';
import { APP_DEEP_LINK_SCHEME } from '@domain/safe-url-config';
import { logger } from '@api/logger';

export function DeepLinkBridge() {
  useEffect(() => {
    function handle(url: string) {
      if (!isAllowedUrl(url)) {
        logger.warn('deep_link_rejected', { url });
        return;
      }
      const parsed = parseAppLink(url, APP_DEEP_LINK_SCHEME);
      if (parsed) {
        // 通过 safe-navigate 跳转
      }
    }

    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    void Linking.getInitialURL().then((url) => url && handle(url));
    return () => sub.remove();
  }, []);

  return null;
}
```

### 推送 link

```ts
Notifications.addNotificationResponseReceivedListener((response) => {
  const payload = response.notification.request.content.data as IPushPayload;
  if (payload.link && isAllowedUrl(payload.link)) {
    // 跳转
  } else {
    logger.warn('push_link_rejected', { link: payload.link });
  }
});
```

## 注意点

- **`isAllowedUrl` 不抛错**：用于条件分支判断（show / hide、enabled / disabled）。
- **`assertAllowedUrl` 抛错**：用于必须拒绝的入口（外部浏览器、deep link）。失败的 throw 由调用方 catch 后派发 toast + logger。
- **新增 host 必须改 config**：不在业务代码硬编码。`safe-url-config.ts` 维护清单 + git history 即审计记录。
- **协议大小写敏感**：`URL` 解析后 `protocol` 是小写带冒号（如 `'https:'`）。
- **`URL` 在 RN 中可用**：Hermes 引擎支持原生 URL API。
- **不做 path-level 校验**：safe-url 只校验"是否可访问"；具体 path 安全（如管理员路径）由后端处理。

## 测试

```ts
// src/test/domain/safe-url.test.ts
import { isAllowedUrl, assertAllowedUrl, parseAppLink } from '@domain/safe-url';

jest.mock('@domain/safe-url-config', () => ({
  APP_DEEP_LINK_SCHEME: 'testapp',
  ALLOWED_EXTERNAL_HOSTS: ['www.example.com'],
  ALLOWED_EXTERNAL_HOST_SUFFIXES: ['.cdn.example.com'],
}));

describe('isAllowedUrl', () => {
  it.each([
    ['https://www.example.com/foo', true],
    ['https://image.cdn.example.com/a.jpg', true],
    ['https://evil.com/foo', false],
    ['http://www.example.com', false], // http 拒绝
    ['mailto:support@example.com', true],
    ['tel:+1234567890', true],
    ['testapp://pay/return', true],
    ['javascript:alert(1)', false],
    ['ftp://server', false],
    ['not a url', false],
  ])('isAllowedUrl(%s) === %s', (url, expected) => {
    expect(isAllowedUrl(url)).toBe(expected);
  });

  it('assertAllowedUrl throws for disallowed URL', () => {
    expect(() => assertAllowedUrl('https://evil.com')).toThrow();
  });
});

describe('parseAppLink', () => {
  it('parses scheme + path', () => {
    const result = parseAppLink('testapp://external/return?requestId=req-1', 'testapp');
    expect(result?.pathname).toBe('/return');
    expect(result?.searchParams.get('requestId')).toBe('req-1');
  });

  it('returns null for non-matching scheme', () => {
    expect(parseAppLink('https://example.com', 'testapp')).toBeNull();
  });
});
```
