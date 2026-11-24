# UI Primitive 模版

> 上级规则：`docs/rules/rn/ui-components.md`、`docs/rules/rn/theme.md`、`docs/rules/rn/accessibility.md`。
>
> 建议落地位置：`src/components/ui/*`。

## 适用场景

新增项目级 UI primitive 组件（Button / Card / Badge / Input / Icon button 等）。

## Button 模版（含 variant / loading / disabled）

```tsx
// src/components/ui/button.tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemeTokens } from '@theme/theme-provider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface IButtonProps {
  /**
   * 按钮文案。
   */
  label: string;
  /**
   * 点击回调。
   */
  onPress?: () => void;
  /**
   * 视觉变体。
   */
  variant?: ButtonVariant;
  /**
   * 禁用态。
   */
  disabled?: boolean;
  /**
   * 加载态。
   */
  loading?: boolean;
  /**
   * 加载态文案，业务侧可传入本地化文案替代默认值。
   */
  loadingLabel?: string;
  /**
   * 测试标识。
   */
  testID?: string;
}

/**
 * 基础按钮组件，提供统一的视觉、交互和禁用逻辑。
 */
export function Button(props: IButtonProps) {
  const {
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    loadingLabel = 'Loading...',
    testID,
  } = props;
  const tokens = useThemeTokens();
  const isDisabled = disabled || loading;

  const variantStyleMap = {
    primary: {
      backgroundColor: tokens.colors.brandPrimary,
      borderColor: tokens.colors.brandPrimary,
      textColor: tokens.colors.textContrast,
    },
    secondary: {
      backgroundColor: tokens.colors.surfaceElevated,
      borderColor: tokens.colors.border,
      textColor: tokens.colors.textPrimary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: tokens.colors.brandDeep,
    },
    danger: {
      backgroundColor: tokens.colors.brandPrimaryStrong,
      borderColor: tokens.colors.brandPrimaryStrong,
      textColor: tokens.colors.textContrast,
    },
  } as const;

  const currentStyle = variantStyleMap[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
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
      {/* loading 期间替换按钮文案，避免用户误以为提交没有响应。 */}
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        maxFontSizeMultiplier={1.3}
        numberOfLines={2}
        style={[
          styles.label,
          {
            color: currentStyle.textColor,
            fontSize: tokens.typography.body,
          },
        ]}
      >
        {loading ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    textAlign: 'center',
    fontWeight: '600',
  },
});
```

## Card 模版（包装层）

```tsx
// src/components/ui/card.tsx
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useThemeTokens } from '@theme/theme-provider';

interface ICardProps extends ViewProps {
  children: React.ReactNode;
}

/**
 * Card primitive 提供统一的轻圆角和单层卡片样式。
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
```

## IconButton 模版（强制 accessibilityLabel）

```tsx
// src/components/ui/icon-button.tsx
import { Pressable, StyleSheet } from 'react-native';
import { useThemeTokens } from '@theme/theme-provider';

interface IIconButtonProps {
  /**
   * 图标节点。
   */
  icon: React.ReactNode;
  /**
   * 必填的可访问标签：描述动作语义（如"打开搜索"）。
   */
  accessibilityLabel: string;
  /**
   * 点击回调。
   */
  onPress?: () => void;
  /**
   * 禁用态。
   */
  disabled?: boolean;
  /**
   * 加载态。
   */
  loading?: boolean;
  /**
   * 测试标识。
   */
  testID?: string;
}

/**
 * IconButton 用于无文字的图标动作；必须传入 accessibilityLabel。
 */
export function IconButton(props: IIconButtonProps) {
  const { icon, accessibilityLabel, onPress, disabled, loading, testID } = props;
  const tokens = useThemeTokens();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.button,
        {
          opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
          padding: tokens.spacing.sm,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

## 注意点

- **a11y 必填**：所有可点击 primitive 必须有 `accessibilityRole` + `accessibilityLabel` + `accessibilityState`。
- **触控目标 ≥ 44pt**：通过 `minHeight` / `minWidth` 或 `hitSlop` 保证。
- **token 消费**：颜色 / 字号 / 间距 / 圆角全部走 token，不硬编码。
- **样式合成**：`StyleSheet.create` 静态 + 数组合并 token。
- **loading 状态**：异步动作必须暴露 loading 或 disabled。
- **testID**：暴露 `testID` prop 供测试。
- **maxFontSizeMultiplier**：标题与按钮文字限制大字号缩放上限。
- **不直接 import `react-native-paper`**：如需 Paper 组件，走 `paper-controls.tsx` wrapper。

## 测试模版

```tsx
// src/test/components/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '@components/ui/button';
import { TestProviders } from '@test/utils/test-providers';

describe('Button', () => {
  it('renders label', () => {
    render(
      <TestProviders>
        <Button label="Submit" />
      </TestProviders>,
    );
    expect(screen.getByText('Submit')).toBeOnTheScreen();
  });

  it('shows loading label when loading', () => {
    render(
      <TestProviders>
        <Button label="Submit" loading loadingLabel="Submitting..." />
      </TestProviders>,
    );
    expect(screen.getByText('Submitting...')).toBeOnTheScreen();
  });

  it('disables press when loading', () => {
    const onPress = jest.fn();
    render(
      <TestProviders>
        <Button label="Submit" loading onPress={onPress} testID="submit" />
      </TestProviders>,
    );
    fireEvent.press(screen.getByTestId('submit'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes accessibility state', () => {
    render(
      <TestProviders>
        <Button label="Submit" loading testID="submit" />
      </TestProviders>,
    );
    expect(screen.getByTestId('submit')).toHaveAccessibilityState({ busy: true, disabled: true });
  });
});
```
