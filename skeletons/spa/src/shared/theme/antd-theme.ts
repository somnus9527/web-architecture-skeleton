import type { ThemeConfig } from 'antd';

import { designTokens } from './design-tokens';

/**
 * 应用唯一的 antd 主题。取值来自 design-tokens，不在这里写第二套品牌色。
 *
 * v6 默认使用 CSS 变量；`hashed: false` 适用于单 antd 版本，减少重复样式体积。
 * 不启用 `zeroRuntime`：它需要额外的静态样式抽取，当前阶段先用官方默认 CSS-in-JS。
 */
export const antdTheme: ThemeConfig = {
  hashed: false,
  cssVar: { key: 'app' },
  token: {
    colorPrimary: designTokens.light.primary,
    colorInfo: designTokens.light.info,
    colorSuccess: designTokens.light.success,
    colorWarning: designTokens.light.warning,
    colorError: designTokens.light.danger,
    colorBgBase: designTokens.light.background,
    colorBgContainer: designTokens.light.surface,
    colorBgElevated: designTokens.light.surface,
    colorText: designTokens.light.text,
    colorTextSecondary: designTokens.light.textMuted,
    colorBorder: designTokens.light.border,
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
      bodyBg: designTokens.light.background,
      headerBg: designTokens.light.surface,
      siderBg: designTokens.light.surface,
    },
  },
};
