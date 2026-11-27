import { theme as antdAlgorithms, type ThemeConfig } from 'antd';

import { designTokens } from './design-tokens';
import type { ResolvedTheme } from './theme-mode';

/**
 * 按当前明暗主题构建 antd 主题。取值来自 design-tokens，不在这里写第二套品牌色。
 *
 * v6 默认使用 CSS 变量；`hashed: false` 适用于单 antd 版本，减少重复样式体积。
 * 不启用 `zeroRuntime`：它需要额外的静态样式抽取，当前阶段先用官方默认 CSS-in-JS。
 */
export function buildAntdTheme(mode: ResolvedTheme): ThemeConfig {
  const tokens = designTokens[mode];

  return {
    hashed: false,
    cssVar: { key: 'app' },
    algorithm: mode === 'dark' ? antdAlgorithms.darkAlgorithm : antdAlgorithms.defaultAlgorithm,
    token: {
      colorPrimary: tokens.primary,
      colorInfo: tokens.info,
      colorSuccess: tokens.success,
      colorWarning: tokens.warning,
      colorError: tokens.danger,
      colorBgBase: tokens.background,
      colorBgContainer: tokens.surface,
      colorBgElevated: tokens.surface,
      colorText: tokens.text,
      colorTextSecondary: tokens.textMuted,
      colorBorder: tokens.border,
      borderRadius: designTokens.shape.borderRadius,
      fontFamily: designTokens.typography.fontFamily,
      fontSize: 14,
      controlHeight: 36,
    },
    components: {
      Button: {
        fontWeight: 500,
      },
      Card: {
        borderRadiusLG: 10,
      },
      Layout: {
        bodyBg: tokens.background,
        headerBg: tokens.surface,
        siderBg: tokens.surface,
      },
    },
  };
}

/**
 * 兼容旧调用点的浅色主题；新代码请用 `buildAntdTheme(mode)` 跟随当前主题。
 */
export const antdTheme: ThemeConfig = buildAntdTheme('light');
