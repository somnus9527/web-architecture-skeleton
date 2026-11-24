import { createTheme, type Theme } from '@mui/material/styles';

/**
 * 应用唯一 MUI 主题。正式项目在完成项目身份绑定后替换品牌色与字体。
 */
export const appTheme: Theme = createTheme({
  shape: {
    borderRadius: 8,
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
    },
    background: {
      default: '#f6f7f9',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
    },
  },
});
