import { MD3LightTheme } from 'react-native-paper';

import { tokens } from '@/domain/theme/tokens';

/**
 * React Native Paper 主题，取值来自 tokens。
 */
export const paperTheme = {
  ...MD3LightTheme,
  roundness: tokens.radius.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: tokens.color.primary,
    background: tokens.color.background,
    surface: tokens.color.surface,
    error: tokens.color.danger,
  },
};
