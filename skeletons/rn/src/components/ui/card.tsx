import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';

import { useThemeTokens } from '@theme/theme-provider';

interface ICardProps extends ViewProps {
  /** 卡片内容。 */
  children: ReactNode;
}

/**
 * Card primitive：统一圆角、边框与单层阴影，颜色全部来自 token。
 *
 * @param props - 卡片属性。
 * @returns 卡片容器。
 */
export function Card(props: ICardProps) {
  const { children, style, ...rest } = props;
  const tokens = useThemeTokens();

  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: tokens.colors.surfaceElevated,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.md,
          boxShadow: tokens.shadows.card,
          padding: tokens.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
