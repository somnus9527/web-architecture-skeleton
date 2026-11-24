import { createTheme, type Theme } from '@mui/material/styles';

import { designTokens } from '@/shared/theme/design-tokens';

/**
 * 应用唯一 MUI 主题，取值全部来自 design-tokens。
 */
export const appTheme: Theme = createTheme({
  shape: {
    borderRadius: designTokens.shape.borderRadius,
  },
  palette: {
    mode: 'light',
    primary: {
      main: designTokens.light.primary,
    },
    background: {
      default: designTokens.light.background,
      paper: designTokens.light.paper,
    },
    text: {
      primary: designTokens.light.text,
      secondary: designTokens.light.textMuted,
    },
  },
  typography: {
    fontFamily: designTokens.typography.fontFamily,
    button: {
      textTransform: 'none',
    },
  },
});
