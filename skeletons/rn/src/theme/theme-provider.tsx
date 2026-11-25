import { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { getThemeTokens, type IThemeTokens, type ThemePreference } from './theme-tokens';

/**
 * ThemeProvider 暴露的上下文值。
 */
export interface IThemeContextValue {
  /** 用户选择的主题偏好。 */
  themePreference: ThemePreference;
  /** 解析后的主题。 */
  resolvedTheme: 'light' | 'dark';
  /** 当前主题 token。 */
  tokens: IThemeTokens;
  /** 切换主题偏好。 */
  setThemePreference: (next: ThemePreference) => void;
}

interface IThemeProviderProps {
  /** 子树。 */
  children: React.ReactNode;
  /** 初始主题偏好，默认亮色。 */
  initialPreference?: ThemePreference;
}

const ThemeContext = createContext<IThemeContextValue | null>(null);

/**
 * 主题 Provider：解析主题偏好并提供 token 与切换入口。
 *
 * @param props - 子树与初始偏好。
 * @returns 主题上下文 Provider。
 */
export function ThemeProvider(props: IThemeProviderProps) {
  const { children, initialPreference = 'light' } = props;
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialPreference);

  const resolvedPreference: 'light' | 'dark' =
    themePreference === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themePreference;

  const tokens = useMemo(() => getThemeTokens(resolvedPreference), [resolvedPreference]);

  const value = useMemo<IThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme: resolvedPreference,
      tokens,
      setThemePreference,
    }),
    [themePreference, resolvedPreference, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 读取当前主题偏好及其解析结果。
 *
 * @returns 主题上下文。
 */
export function useAppTheme(): IThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * 供 UI 组件直接读取当前主题 token。
 *
 * @returns 当前主题 token。
 */
export function useThemeTokens(): IThemeTokens {
  return useAppTheme().tokens;
}
