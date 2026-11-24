# i18n Setup 模版

> 上级规则：`docs/rules/rn/i18n.md`、`docs/rules/rn/state-management.md`、`docs/rules/rn/startup.md`。

## 适用场景

新项目搭建 i18n 系统，含 i18next 初始化、locale store、locale provider、文案文件组织。

## 完整模版

### 目录结构

```
src/domain/locale/
  constants.ts         # 语言列表 / 别名 / fallback 链
  i18n.ts              # i18next 实例初始化
  locale-store.ts      # Zustand store（持久化当前 locale）
  locale-provider.tsx  # Provider：触发 hydration + 同步 i18next
  price-format.ts      # 货币格式化 helper（独立）
  messages/
    locales/
      en.ts
      zh.ts
      <locale>.ts
    index.ts           # 聚合所有 locale 文件
```

### constants.ts

```ts
// src/domain/locale/constants.ts

/**
 * 应用支持的 locale 列表。新增 locale 时在此追加，并补充对应的 messages 文件。
 */
export const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * 默认 locale，作为 fallback 终点。
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Locale 别名归一化。从设备 locale（如 `zh-Hans-CN`）映射到项目支持的 locale。
 */
const LOCALE_ALIASES: Record<string, SupportedLocale> = {
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'en-us': 'en',
  'en-gb': 'en',
  'ja-jp': 'ja',
  'ko-kr': 'ko',
};

/**
 * 把任意 locale 字符串归一化到项目支持的 locale；无匹配时返回默认 locale。
 *
 * @example
 *   normalizeLocale('zh-Hans-CN')  // 'zh'
 *   normalizeLocale('fr')          // 'en'（不支持，回退到默认）
 */
export function normalizeLocale(input: string | undefined | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;

  const lower = input.toLowerCase();
  if ((SUPPORTED_LOCALES as readonly string[]).includes(lower)) {
    return lower as SupportedLocale;
  }
  if (LOCALE_ALIASES[lower]) {
    return LOCALE_ALIASES[lower];
  }

  // 取主语言部分（'zh-CN' → 'zh'）
  const primary = lower.split('-')[0];
  if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
    return primary as SupportedLocale;
  }

  return DEFAULT_LOCALE;
}

/**
 * 当前 locale 是否为 RTL 语言。当前项目不支持 RTL，所有支持的 locale 均返回 false。
 */
export function isRtlLocale(_locale: SupportedLocale): boolean {
  return false;
}
```

### messages/locales/en.ts

```ts
// src/domain/locale/messages/locales/en.ts
export const enMessages = {
  common: {
    error: {
      title: 'Something went wrong',
      description: 'Please try again later.',
      retry: 'Retry',
      generic: 'Request failed. Please try again.',
    },
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
  },
  errors: {
    boundary: {
      title: 'Something went wrong',
      description: 'The app encountered an error. Please try again. If the problem persists, contact support.',
      reset: 'Retry',
    },
  },
  auth: {
    login: {
      title: 'Sign in',
      submit: 'Sign in',
      field: {
        email: { label: 'Email', placeholder: 'name@example.com' },
        password: { label: 'Password', placeholder: 'Enter password' },
      },
      error: {
        emailRequired: 'Email is required',
        emailInvalid: 'Email is invalid',
        passwordRequired: 'Password is required',
        generic: 'Sign in failed. Please try again.',
      },
    },
    register: {
      title: 'Create account',
      submit: 'Create account',
      // ...
    },
  },
  // 业务模块按 feature 划分
} as const;

export type AppMessages = typeof enMessages;
```

### messages/locales/zh.ts

```ts
// src/domain/locale/messages/locales/zh.ts
import type { AppMessages } from './en';

export const zhMessages: AppMessages = {
  common: {
    error: {
      title: '出了一点问题',
      description: '请稍后重试。',
      retry: '重试',
      generic: '请求失败，请重试。',
    },
    back: '返回',
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    loading: '加载中...',
  },
  errors: {
    boundary: {
      title: '出了一点问题',
      description: '应用遇到错误，请重试。如果问题持续，请联系客服。',
      reset: '重试',
    },
  },
  auth: {
    login: {
      title: '登录',
      submit: '登录',
      field: {
        email: { label: '邮箱', placeholder: 'name@example.com' },
        password: { label: '密码', placeholder: '请输入密码' },
      },
      error: {
        emailRequired: '请输入邮箱',
        emailInvalid: '邮箱格式不正确',
        passwordRequired: '请输入密码',
        generic: '登录失败，请重试。',
      },
    },
    register: {
      title: '注册',
      submit: '注册',
      // ...
    },
  },
};
```

### messages/index.ts

```ts
// src/domain/locale/messages/index.ts
import { enMessages } from './locales/en';
import { zhMessages } from './locales/zh';
// ... 其他 locale

import type { SupportedLocale } from '../constants';
import type { AppMessages } from './locales/en';

/**
 * 所有 locale 的 messages 聚合，注入到 i18next resources。
 */
export const MESSAGES: Record<SupportedLocale, AppMessages> = {
  en: enMessages,
  zh: zhMessages,
  ja: enMessages, // 占位：未翻译时 fallback 到英文
  ko: enMessages,
};
```

### i18n.ts

```ts
// src/domain/locale/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './constants';
import { MESSAGES } from './messages';

/**
 * 初始化 i18next 实例。在 LocaleProvider mount 时调用一次。
 */
export async function initI18n(initialLocale: string = DEFAULT_LOCALE): Promise<void> {
  if (i18n.isInitialized) return;

  await i18n.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    resources: Object.fromEntries(
      Object.entries(MESSAGES).map(([locale, messages]) => [locale, { translation: messages }]),
    ),
    interpolation: {
      escapeValue: false, // React 自己 escape
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
  });
}

/**
 * 切换 i18next 当前 locale。
 */
export async function changeI18nLocale(locale: string): Promise<void> {
  await i18n.changeLanguage(locale);
}
```

### locale-store.ts

```ts
// src/domain/locale/locale-store.ts
import { create } from 'zustand';
import * as Localization from 'expo-localization';

import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from './constants';
import { clearPersistedJson, readPersistedJson, writePersistedJson, type JsonStorage } from '@storage/persisted-json';
import { changeI18nLocale, initI18n } from './i18n';

const LOCALE_STORAGE_KEY = '<app-namespace>.locale';

export interface ILocaleStoreState {
  locale: SupportedLocale;
  hasHydrated: boolean;
  hydrate: (storage?: JsonStorage) => Promise<void>;
  setLocale: (locale: SupportedLocale, storage?: JsonStorage) => Promise<void>;
}

export const useLocaleStore = create<ILocaleStoreState>((set) => ({
  locale: DEFAULT_LOCALE,
  hasHydrated: false,

  /**
   * 启动时恢复 locale：先读 storage，没有则读设备 locale，再 fallback 到默认。
   */
  hydrate: async (storage) => {
    const persisted = await readPersistedJson<SupportedLocale>(LOCALE_STORAGE_KEY, storage);
    const deviceLocale = Localization.getLocales()[0]?.languageTag;
    const resolved = persisted ?? normalizeLocale(deviceLocale);

    await initI18n(resolved);
    set({ locale: resolved, hasHydrated: true });
  },

  /**
   * 用户切换 locale；同步 i18next + 持久化。
   */
  setLocale: async (locale, storage) => {
    await changeI18nLocale(locale);
    await writePersistedJson(LOCALE_STORAGE_KEY, locale, storage);
    set({ locale });
  },
}));
```

### locale-provider.tsx

```tsx
// src/domain/locale/locale-provider.tsx
import { useEffect, type ReactNode } from 'react';
import { useLocaleStore } from './locale-store';

interface ILocaleProviderProps {
  children: ReactNode;
}

/**
 * 在 mount 时触发 locale 恢复 + i18next 初始化。
 *
 * splash 隐藏依赖 useLocaleStore.hasHydrated（详见 docs/rules/rn/startup.md）。
 */
export function LocaleProvider({ children }: ILocaleProviderProps) {
  useEffect(() => {
    void useLocaleStore.getState().hydrate();
  }, []);

  return <>{children}</>;
}
```

## 在业务代码使用

### 基础翻译

```tsx
import { useTranslation } from 'react-i18next';

function Welcome({ userName }: { userName: string }) {
  const { t } = useTranslation();
  return <Text>{t('common.greeting', { name: userName })}</Text>;
}
```

### 复数

```ts
// messages/locales/en.ts
feature: {
  itemCount_one: '{{count}} item',
  itemCount_other: '{{count}} items',
}

// 使用
t('feature.itemCount', { count: items.length });
```

### 切换 locale

```tsx
function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleStore();

  return (
    <View>
      {SUPPORTED_LOCALES.map((l) => (
        <PressableSurface
          key={l}
          onPress={() => void setLocale(l)}
          accessibilityRole="button"
          accessibilityState={{ selected: locale === l }}
        >
          <Text>{l.toUpperCase()}</Text>
        </PressableSurface>
      ))}
    </View>
  );
}
```

## 注意点

- **AppMessages 用 `typeof enMessages` 提供类型**：其他 locale 文件必须实现相同 shape，缺 key 编译期发现。
- **未翻译 locale 暂时 fallback 到 en**：`MESSAGES.ja = enMessages` 占位，标记 TODO，比 i18next runtime fallback 更直接。
- **不在 i18n 中放业务计算**：复杂 logic 走 domain helper（如 `price-format.ts`）。
- **`returnNull: false`**：i18next 找不到 key 时返回 key 名而不是 null，避免 React render error。
- **`useSuspense: false`**：避免与 React Query 等其他 Suspense 边界冲突；自己控制 loading。
- **`useTranslation()` 返回的 `t` 在 locale 切换时自动重新渲染**：react-i18next 已处理。
- **Query key 包含 locale**：依赖 locale 的 API 请求在 query key 中带 locale，避免切换后缓存错位（详见 `docs/rules/rn/state-management.md`）。

## i18n + React Query 联动

```ts
const { locale } = useLocaleStore();

useQuery({
  queryKey: ['feature', 'item-detail', id, locale],
  queryFn: () => getItemDetail(id, { locale }),
});
```

切换 locale → query key 变化 → 自动 refetch 新 locale 数据。

## 测试

```ts
// src/test/domain/locale/locale-store.test.ts
import { useLocaleStore } from '@domain/locale/locale-store';

describe('locale-store', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: 'en', hasHydrated: false });
  });

  it('hydrates from storage', async () => {
    const storage = {
      read: jest.fn().mockResolvedValue('zh'),
      write: jest.fn(),
      clear: jest.fn(),
    };
    await useLocaleStore.getState().hydrate(storage);
    expect(useLocaleStore.getState().locale).toBe('zh');
    expect(useLocaleStore.getState().hasHydrated).toBe(true);
  });

  it('falls back to device locale when no persisted value', async () => {
    const storage = { read: jest.fn().mockResolvedValue(null), write: jest.fn(), clear: jest.fn() };
    // Mock expo-localization Localization.getLocales
    jest.mock('expo-localization', () => ({
      getLocales: () => [{ languageTag: 'zh-CN' }],
    }));
    await useLocaleStore.getState().hydrate(storage);
    expect(useLocaleStore.getState().locale).toBe('zh');
  });

  it('persists on setLocale', async () => {
    const storage = {
      read: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    await useLocaleStore.getState().setLocale('zh', storage);
    expect(storage.write).toHaveBeenCalledWith('<app-namespace>.locale', 'zh');
  });
});
```
