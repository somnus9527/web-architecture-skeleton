import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import type { IThemeTokens } from '@theme/theme-tokens';

/**
 * 项目 token → React Native Paper MD3 theme 映射。
 *
 * 只允许在 `src/theme/*`、`paper-theme-provider` 与 `paper-controls` 中使用；
 * 业务代码消费项目 token，不读取 Paper theme 内部结构。
 *
 * @param tokens - 当前主题 token。
 * @returns 与 token 对齐的 Paper MD3 主题。
 */
export function getPaperTheme(tokens: IThemeTokens): MD3Theme {
  const base = tokens.resolvedTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    roundness: tokens.radius.md,
    colors: {
      ...base.colors,
      primary: tokens.colors.brandPrimary,
      secondary: tokens.colors.brandPrimaryStrong,
      background: tokens.colors.surface,
      surface: tokens.colors.surfaceElevated,
      error: tokens.colors.statusDanger,
      onSurface: tokens.colors.textPrimary,
      outline: tokens.colors.border,
    },
  };
}
