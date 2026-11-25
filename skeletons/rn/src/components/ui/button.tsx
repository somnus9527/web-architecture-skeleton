import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeTokens } from '@theme/theme-provider';

import { AppText } from './app-text';

/**
 * 按钮视觉变体。
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface IButtonProps {
  /** 按钮文案。 */
  label: string;
  /** 点击回调。 */
  onPress?: () => void;
  /** 视觉变体，默认 primary。 */
  variant?: ButtonVariant;
  /** 禁用态。 */
  disabled?: boolean;
  /** 加载态；加载中同时禁用点击。 */
  loading?: boolean;
  /** 加载态文案，业务侧传入本地化文案。 */
  loadingLabel?: string;
  /** 测试标识。 */
  testID?: string;
  /** 左侧图标。 */
  icon?: ReactNode;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  label: {
    textAlign: 'center',
  },
});

/**
 * 基础按钮 primitive，提供统一的视觉、交互、a11y 与禁用 / 加载逻辑。
 *
 * @param props - 按钮属性。
 * @returns 按钮节点。
 */
export function Button(props: IButtonProps) {
  const { label, onPress, variant = 'primary', disabled = false, loading = false, loadingLabel, testID, icon } = props;
  const tokens = useThemeTokens();
  const isDisabled = disabled || loading;

  const variantStyleMap = {
    primary: {
      backgroundColor: tokens.colors.brandPrimary,
      borderColor: tokens.colors.brandPrimary,
      textTone: 'contrast',
    },
    secondary: {
      backgroundColor: tokens.colors.surfaceElevated,
      borderColor: tokens.colors.border,
      textTone: 'primary',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textTone: 'primary',
    },
    danger: {
      backgroundColor: tokens.colors.statusDanger,
      borderColor: tokens.colors.statusDanger,
      textTone: 'contrast',
    },
  } as const;

  const currentStyle = variantStyleMap[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: currentStyle.backgroundColor,
          borderColor: currentStyle.borderColor,
          borderRadius: tokens.radius.md,
          boxShadow: variant === 'primary' ? tokens.shadows.card : undefined,
          opacity: isDisabled ? 0.5 : pressed ? 0.86 : 1,
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.sm,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
      ]}
    >
      {icon ? <View>{icon}</View> : null}
      {/* loading 期间替换文案，避免用户误以为提交没有响应。 */}
      <AppText numberOfLines={2} style={styles.label} tone={currentStyle.textTone} variant="body" weight="semibold">
        {loading ? (loadingLabel ?? label) : label}
      </AppText>
    </Pressable>
  );
}
