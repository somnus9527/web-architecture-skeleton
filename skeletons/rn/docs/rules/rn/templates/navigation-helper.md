# Navigation Helper Template

> 上级规则：`docs/rules/rn/routing.md`、`docs/rules/rn/security.md`。

## 适用场景

来源于 API 响应、静态配置、远程运营位或用户输入的路径，不能直接传给 Expo Router。先通过白名单 helper 校验，再执行跳转。

## `src/components/navigation/safe-navigate.ts`

```ts
import type { Href, Router } from 'expo-router';

export type AppRoutePath = `/${string}`;

export interface ISafeNavigateOptions {
  allowedPathPrefixes?: readonly AppRoutePath[];
}

const DEFAULT_ALLOWED_PATH_PREFIXES: readonly AppRoutePath[] = ['/(tabs)', '/(auth)', '/(modals)', '/(static)'];

function getAllowedPathPrefixes(options?: ISafeNavigateOptions): readonly AppRoutePath[] {
  return options?.allowedPathPrefixes ?? DEFAULT_ALLOWED_PATH_PREFIXES;
}

export function isAllowedPath(path: string, options?: ISafeNavigateOptions): path is AppRoutePath {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  if (path.includes('\\')) return false;

  const [pathname] = path.split('?');
  return getAllowedPathPrefixes(options).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function toSafeHref(path: string, options?: ISafeNavigateOptions): Href | null {
  if (!isAllowedPath(path, options)) return null;
  return path as Href;
}

export function pushPath(router: Router, path: string, options?: ISafeNavigateOptions): boolean {
  const href = toSafeHref(path, options);
  if (!href) return false;
  router.push(href);
  return true;
}

export function replacePath(router: Router, path: string, options?: ISafeNavigateOptions): boolean {
  const href = toSafeHref(path, options);
  if (!href) return false;
  router.replace(href);
  return true;
}
```

## 使用方式

```ts
import { useRouter } from 'expo-router';
import { pushPath } from '@components/navigation/safe-navigate';

export function useRemoteCtaNavigation() {
  const router = useRouter();

  return (href: string) => {
    const didNavigate = pushPath(router, href);
    if (!didNavigate) {
      // logger.warn('navigation_rejected', { href });
    }
  };
}
```

## 测试要点

- 接受项目声明过的内部路径前缀。
- 拒绝外部 URL、协议相对 URL、反斜杠路径和未知前缀。
- `pushPath` / `replacePath` 在路径不合法时返回 `false` 且不调用 router。
