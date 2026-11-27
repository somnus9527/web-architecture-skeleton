import { createContext, useContext } from 'react';

import type { ResolvedTheme, ThemeMode } from './theme-mode';

/**
 * 主题上下文值。
 */
export interface IThemeModeContextValue {
  /** 用户选择的模式（含 system）。 */
  mode: ThemeMode;
  /** 实际生效的明暗主题。 */
  resolved: ResolvedTheme;
  /** 显式设置模式。 */
  setMode: (mode: ThemeMode) => void;
}

/**
 * 主题上下文；由 `ThemeModeProvider` 提供。
 */
export const ThemeModeContext = createContext<IThemeModeContextValue | null>(null);

/**
 * 读取主题上下文；脱离 Provider 使用时直接报错，避免静默渲染成错误主题。
 *
 * @returns 主题模式与操作。
 */
export function useThemeMode(): IThemeModeContextValue {
  const value = useContext(ThemeModeContext);

  if (!value) {
    throw new Error('useThemeMode 必须在 ThemeModeProvider 内使用。');
  }

  return value;
}
