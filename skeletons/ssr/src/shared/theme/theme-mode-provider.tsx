import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  applyResolvedTheme,
  readStoredThemeMode,
  resolveTheme,
  storeThemeMode,
  systemPrefersDark,
  type ThemeMode,
} from './theme-mode';

import { ThemeModeContext } from './theme-mode-context';

/**
 * 主题模式 Provider：解析 system、写 `<html data-theme>`、同步 localStorage 与 cookie。
 *
 * @param props - 初始模式（SSR 从 cookie 注入）与子树。
 * @returns 主题上下文 Provider。
 */
export function ThemeModeProvider({ children, initialMode }: { children: ReactNode; initialMode?: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(() => initialMode ?? readStoredThemeMode() ?? 'system');
  const [prefersDark, setPrefersDark] = useState<boolean>(() => systemPrefersDark());
  const resolved = resolveTheme(mode, prefersDark);

  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    storeThemeMode(mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent): void => setPrefersDark(event.matches);

    query.addEventListener('change', handleChange);

    return () => query.removeEventListener('change', handleChange);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}
