import { createTheme, type Theme } from '@mui/material/styles';

import { designTokens } from '@/shared/theme/design-tokens';

declare module '@mui/material/styles' {
  // MUI 的模块扩展要求固定接口名，不能按项目 I 前缀规则改名。
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface BreakpointOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    xl: true;
    tablet: true;
    laptop: true;
    desktop: true;
    wide: true;
    ultra: true;
  }
}

/**
 * 应用唯一 MUI 主题，取值全部来自 design-tokens。
 */
export const appTheme: Theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
      ...designTokens.breakpoints,
    },
  },
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
