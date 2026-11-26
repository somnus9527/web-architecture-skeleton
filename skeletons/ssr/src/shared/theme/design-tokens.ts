/**
 * 中性设计 token。应用 CSS 与 antd ThemeConfig 的唯一取值来源。
 *
 * 业务项目复制骨架后只改这里；`tokens.css` 中的 CSS 变量必须与这里保持同值，
 * 由 `src/test/architecture/design-tokens.test.ts` 做一致性校验。
 */
export const designTokens = {
  light: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    background: '#f6f7f9',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    danger: '#dc2626',
    success: '#059669',
    warning: '#d97706',
    info: '#2563eb',
  },
  dark: {
    primary: '#60a5fa',
    primaryHover: '#93c5fd',
    background: '#0f1115',
    surface: '#171a21',
    surfaceMuted: '#1f242d',
    text: '#e5e7eb',
    textMuted: '#94a3b8',
    border: '#334155',
    danger: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#60a5fa',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    full: '999px',
  },
  fontSize: {
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
  shadow: {
    sm: '0 1px 2px rgb(15 23 42 / 6%)',
    md: '0 8px 24px rgb(15 23 42 / 10%)',
  },
  breakpoints: {
    tablet: 768,
    laptop: 1024,
    desktop: 1280,
    wide: 1440,
    ultra: 1920,
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
} as const;
