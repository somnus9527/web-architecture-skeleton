/**
 * 中性设计 token。作为主题的唯一取值来源，业务项目可在此替换品牌色。
 * 骨架不含任何具体业务配色（相对基线去除了业务专属 token）。
 */
export const designTokens = {
  light: {
    primary: '#3B6FEF',
    background: '#f7f8fa',
    paper: '#ffffff',
    text: '#1f2933',
  },
  dark: {
    primary: '#62A0FA',
    background: '#0f1115',
    paper: '#171a21',
    text: '#e5e7eb',
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
  fontFamily: 'var(--font-sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)',
} as const;
