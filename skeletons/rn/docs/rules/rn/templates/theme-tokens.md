# Theme Tokens 模版

> 上级规则：`docs/rules/rn/theme.md`。
>
> 建议落地位置：`src/theme/theme-tokens.ts` + `src/theme/theme-provider.tsx`。

## 适用场景

新项目搭建主题系统，或在现有项目中扩展 token。

## Token 结构

```ts
// src/theme/theme-tokens.ts

/**
 * 主题偏好。
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * 颜色 token。语义化命名，跨亮暗色名字稳定。
 */
export interface IThemeColors {
  // 背景层级
  surface: string; // 主背景面
  surfaceMuted: string; // 弱化背景面
  surfaceElevated: string; // 浮层背景面
  surfaceStrong: string; // 强调背景面
  surfaceHighlight: string; // 高亮背景面
  surfaceSoft: string; // 柔和背景面
  surfaceFrost: string; // 玻璃拟态半透明

  // 文字层级
  textPrimary: string; // 主要文字
  textSecondary: string; // 次级文字
  textMuted: string; // 弱提示文字
  textContrast: string; // 深色 CTA 上的反白文字

  // 边框 / 遮罩
  border: string; // 边框基准色
  scrim: string; // 浮层遮罩

  // 品牌
  brandPrimary: string; // 品牌主色
  brandPrimaryStrong: string; // 品牌强调色
  brandDeep: string; // 深色品牌色
  brandSoft: string; // 柔和品牌色

  // 状态
  statusSuccess: string;
  statusWarning: string;
  statusDanger: string;
  statusInfo: string;
}

/**
 * 间距 token。
 */
export interface IThemeSpacing {
  xs: number; // 4
  sm: number; // 8
  md: number; // 12
  lg: number; // 16
  xl: number; // 24
  xxl: number; // 32
}

/**
 * 圆角 token。
 */
export interface IThemeRadius {
  sm: number; // 6
  md: number; // 10
  lg: number; // 16
  pill: number; // 999
}

/**
 * 字号 token。
 */
export interface IThemeTypography {
  caption: number; // 12
  body: number; // 14
  title: number; // 18
  display: number; // 24
}

/**
 * 阴影 token。当前 RN 版本原生支持 boxShadow 字符串语法。
 */
export interface IThemeShadows {
  card: string; // 例: '0 2px 8px rgba(0,0,0,0.08)'
  modal: string;
  popover: string;
}

/**
 * 主题 token 完整集。
 */
export interface IThemeTokens {
  resolvedTheme: 'light' | 'dark';
  colors: IThemeColors;
  spacing: IThemeSpacing;
  radius: IThemeRadius;
  typography: IThemeTypography;
  shadows: IThemeShadows;
}

/**
 * 亮色 token。
 */
const lightTokens: IThemeTokens = {
  resolvedTheme: 'light',
  colors: {
    surface: '#FFFFFF',
    surfaceMuted: '#F5F6F8',
    surfaceElevated: '#FFFFFF',
    surfaceStrong: '#FFE6D9',
    surfaceHighlight: '#FFF1E6',
    surfaceSoft: '#EAF3FF',
    surfaceFrost: 'rgba(255, 255, 255, 0.7)',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    textMuted: '#999999',
    textContrast: '#FFFFFF',
    border: '#E5E7EB',
    scrim: 'rgba(0, 0, 0, 0.4)',
    brandPrimary: '#FF6B35',
    brandPrimaryStrong: '#E55A2B',
    brandDeep: '#1F2A5C',
    brandSoft: '#FFD9C7',
    statusSuccess: '#16A34A',
    statusWarning: '#F59E0B',
    statusDanger: '#DC2626',
    statusInfo: '#0EA5E9',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: { caption: 12, body: 14, title: 18, display: 24 },
  shadows: {
    card: '0 2px 8px rgba(0,0,0,0.08)',
    modal: '0 8px 24px rgba(0,0,0,0.16)',
    popover: '0 4px 12px rgba(0,0,0,0.10)',
  },
};

/**
 * 暗色 token。值按设计语义重新指定，不是亮色的反相。
 */
const darkTokens: IThemeTokens = {
  resolvedTheme: 'dark',
  colors: {
    surface: '#0F1116',
    surfaceMuted: '#1A1D24',
    surfaceElevated: '#1F232C',
    surfaceStrong: '#3A2A20',
    surfaceHighlight: '#2A1F18',
    surfaceSoft: '#1A2538',
    surfaceFrost: 'rgba(31, 35, 44, 0.7)',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    textMuted: '#888888',
    textContrast: '#1A1A1A',
    border: '#2A2E37',
    scrim: 'rgba(0, 0, 0, 0.6)',
    brandPrimary: '#FF7C4A',
    brandPrimaryStrong: '#E55A2B',
    brandDeep: '#3D4A8A',
    brandSoft: '#5C4A3A',
    statusSuccess: '#22C55E',
    statusWarning: '#FACC15',
    statusDanger: '#EF4444',
    statusInfo: '#38BDF8',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: { caption: 12, body: 14, title: 18, display: 24 },
  shadows: {
    card: '0 2px 8px rgba(0,0,0,0.4)',
    modal: '0 8px 24px rgba(0,0,0,0.6)',
    popover: '0 4px 12px rgba(0,0,0,0.5)',
  },
};

/**
 * 按主题偏好返回 token。
 */
export function getThemeTokens(preference: 'light' | 'dark'): IThemeTokens {
  return preference === 'dark' ? darkTokens : lightTokens;
}
```

## Provider

```tsx
// src/theme/theme-provider.tsx
import { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { getThemeTokens, type IThemeTokens, type ThemePreference } from './theme-tokens';

export interface IThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  tokens: IThemeTokens;
  setThemePreference: (next: ThemePreference) => void;
}

interface IThemeProviderProps {
  children: React.ReactNode;
  initialPreference?: ThemePreference;
}

const ThemeContext = createContext<IThemeContextValue | null>(null);

/**
 * ThemeProvider 提供主题偏好与解析后的 token。
 */
export function ThemeProvider(props: IThemeProviderProps) {
  const { children, initialPreference = 'light' } = props;
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialPreference);

  const resolvedPreference =
    themePreference === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themePreference;

  const tokens = getThemeTokens(resolvedPreference);

  const value = useMemo<IThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme: tokens.resolvedTheme,
      tokens,
      setThemePreference,
    }),
    [themePreference, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 读取当前主题偏好及其解析结果。
 */
export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * 供 UI 组件直接读取当前主题 token。
 */
export function useThemeTokens() {
  return useAppTheme().tokens;
}
```

## 消费模版

```tsx
function MyCard({ children }: { children: React.ReactNode }) {
  const tokens = useThemeTokens();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.colors.surfaceElevated,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.md,
          padding: tokens.spacing.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
```

## 注意点

- 添加新 token 时必须同时给出亮 / 暗双值。
- token 命名语义化，不靠数字 / 颜色字面量。
- 不在业务代码硬编码颜色 / 字号 / 间距。
- StyleSheet 静态对象 + 数组合并 token，避免行内大对象。

## 测试

```ts
// src/test/theme/theme-tokens.test.ts
import { getThemeTokens } from '@theme/theme-tokens';

describe('getThemeTokens', () => {
  it('returns light tokens', () => {
    const tokens = getThemeTokens('light');
    expect(tokens.resolvedTheme).toBe('light');
    expect(tokens.colors.surface).toBe('#FFFFFF');
  });

  it('returns dark tokens', () => {
    const tokens = getThemeTokens('dark');
    expect(tokens.resolvedTheme).toBe('dark');
    expect(tokens.colors.surface).toBe('#0F1116');
  });

  it('shares spacing across light and dark', () => {
    expect(getThemeTokens('light').spacing).toEqual(getThemeTokens('dark').spacing);
  });
});
```
