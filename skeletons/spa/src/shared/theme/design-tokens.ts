/**
 * 中性设计 token。作为主题的唯一取值来源，业务项目在此替换品牌色与字体。
 */
export const designTokens = {
  light: {
    primary: '#2563eb',
    background: '#f6f7f9',
    paper: '#ffffff',
    text: '#0f172a',
    textMuted: '#475569',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
} as const;
