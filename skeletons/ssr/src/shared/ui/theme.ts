import { createTheme } from '@mui/material/styles';

import { designTokens } from './design-tokens';

declare module '@mui/material/styles' {
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
  }
}

/**
 * 应用主题。启用 CSS variables + 亮暗 colorSchemes，避免暗色模式首屏闪烁；
 * 所有取值来自中性 design tokens，只在 provider 挂载一次。
 */
export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: designTokens.light.primary },
        background: { default: designTokens.light.background, paper: designTokens.light.paper },
        text: { primary: designTokens.light.text },
      },
    },
    dark: {
      palette: {
        primary: { main: designTokens.dark.primary },
        background: { default: designTokens.dark.background, paper: designTokens.dark.paper },
        text: { primary: designTokens.dark.text },
      },
    },
  },
  shape: {
    borderRadius: designTokens.shape.borderRadius,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
      tablet: 768,
      laptop: 1024,
      desktop: 1280,
      wide: 1440,
    },
  },
  typography: {
    fontFamily: designTokens.fontFamily,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '10px',
          backgroundColor: '#111827',
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)',
          color: '#f8fafc',
          fontFamily: designTokens.fontFamily,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.35,
        },
        arrow: {
          color: '#111827',
        },
      },
    },
  },
});
