import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeTokens } from '@theme/theme-provider';

/**
 * 文本层级。
 */
export type AppTextVariant = 'caption' | 'body' | 'title' | 'display';

/**
 * 文本颜色语义。
 */
export type AppTextTone = 'primary' | 'secondary' | 'muted' | 'contrast' | 'danger' | 'success';

interface IAppTextProps extends TextProps {
  /** 文本内容。 */
  children: React.ReactNode;
  /** 字号层级，默认 body。 */
  variant?: AppTextVariant;
  /** 颜色语义，默认 primary。 */
  tone?: AppTextTone;
  /** 字重，默认 regular。 */
  weight?: 'regular' | 'medium' | 'semibold';
}

/**
 * 统一文本 primitive：字号与颜色只走主题 token。
 *
 * @param props - 文本属性。
 * @returns 文本节点。
 */
export function AppText(props: IAppTextProps) {
  const { children, variant = 'body', tone = 'primary', weight = 'regular', style, ...rest } = props;
  const tokens = useThemeTokens();

  const toneColorMap: Record<AppTextTone, string> = {
    primary: tokens.colors.textPrimary,
    secondary: tokens.colors.textSecondary,
    muted: tokens.colors.textMuted,
    contrast: tokens.colors.textContrast,
    danger: tokens.colors.statusDanger,
    success: tokens.colors.statusSuccess,
  };

  const weightMap: Record<NonNullable<IAppTextProps['weight']>, '400' | '500' | '600'> = {
    regular: '400',
    medium: '500',
    semibold: '600',
  };

  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.4}
      style={[
        styles.base,
        {
          color: toneColorMap[tone],
          fontSize: tokens.typography[variant],
          fontWeight: weightMap[weight],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
});
