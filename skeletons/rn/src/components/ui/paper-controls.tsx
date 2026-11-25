import { Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, RadioButton, Snackbar, Switch } from 'react-native-paper';

import { useThemeTokens } from '@theme/theme-provider';

import { AppText } from './app-text';

/**
 * Paper 组件的唯一 wrapper 出口。
 *
 * 业务代码不允许直接 import `react-native-paper`；需要 Paper 的复杂控件
 * （Switch / Checkbox / Radio / Snackbar 等）时从本文件按需取用。
 */

interface IPaperSwitchProps {
  /** 开关值。 */
  value: boolean;
  /** 值变化回调。 */
  onValueChange: (nextValue: boolean) => void;
  /** 可访问标签。 */
  accessibilityLabel: string;
  /** 禁用态。 */
  disabled?: boolean;
  /** 测试标识。 */
  testID?: string;
}

/**
 * Paper Switch wrapper，颜色取自项目 token。
 *
 * @param props - 开关属性。
 * @returns 开关节点。
 */
export function PaperSwitch(props: IPaperSwitchProps) {
  const { value, onValueChange, accessibilityLabel, disabled = false, testID } = props;
  const tokens = useThemeTokens();

  return (
    <Switch
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      color={tokens.colors.brandPrimary}
      disabled={disabled}
      onValueChange={onValueChange}
      testID={testID}
      value={value}
    />
  );
}

interface IPaperCheckboxProps {
  /** 是否勾选。 */
  value: boolean;
  /** 点击回调。 */
  onPress: () => void;
  /** 可访问标签，同时作为行内文案。 */
  label: string;
  /** 禁用态。 */
  disabled?: boolean;
  /** 测试标识。 */
  testID?: string;
}

/**
 * Paper Checkbox wrapper：勾选控件 + 行内文案，整行可点击且满足 44pt 触控目标。
 *
 * @param props - 复选属性。
 * @returns 复选节点。
 */
export function PaperCheckbox(props: IPaperCheckboxProps) {
  const { value, onPress, label, disabled = false, testID } = props;
  const tokens = useThemeTokens();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={{ bottom: 4, left: 4, right: 4, top: 4 }}
      onPress={onPress}
      style={[styles.row, { gap: tokens.spacing.sm, minHeight: 44 }]}
      testID={testID}
    >
      <View pointerEvents="none">
        <Checkbox color={tokens.colors.brandPrimary} disabled={disabled} status={value ? 'checked' : 'unchecked'} />
      </View>
      <AppText tone={disabled ? 'muted' : 'primary'}>{label}</AppText>
    </Pressable>
  );
}

interface IPaperRadioProps {
  /** 选项值，用于外部判定选中。 */
  value: string;
  /** 是否选中。 */
  selected: boolean;
  /** 点击回调。 */
  onPress: () => void;
  /** 可访问标签，同时作为行内文案。 */
  label: string;
  /** 禁用态。 */
  disabled?: boolean;
  /** 测试标识。 */
  testID?: string;
}

/**
 * Paper Radio wrapper：单选项 + 行内文案。
 *
 * @param props - 单选属性。
 * @returns 单选节点。
 */
export function PaperRadio(props: IPaperRadioProps) {
  const { value, selected, onPress, label, disabled = false, testID } = props;
  const tokens = useThemeTokens();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      hitSlop={{ bottom: 4, left: 4, right: 4, top: 4 }}
      onPress={onPress}
      style={[styles.row, { gap: tokens.spacing.sm, minHeight: 44 }]}
      testID={testID}
    >
      <View pointerEvents="none">
        <RadioButton
          color={tokens.colors.brandPrimary}
          disabled={disabled}
          status={selected ? 'checked' : 'unchecked'}
          value={value}
        />
      </View>
      <AppText tone={disabled ? 'muted' : 'primary'}>{label}</AppText>
    </Pressable>
  );
}

interface IPaperSnackbarProps {
  /** 是否可见。 */
  visible: boolean;
  /** 提示文案。 */
  message: string;
  /** 关闭回调，必须同步更新 visible。 */
  onDismiss: () => void;
  /** 操作按钮文案。 */
  actionLabel?: string;
  /** 操作按钮回调。 */
  onAction?: () => void;
  /** 展示时长，单位毫秒。 */
  duration?: number;
  /** 测试标识。 */
  testID?: string;
}

/**
 * Paper Snackbar wrapper。
 *
 * @param props - Snackbar 属性。
 * @returns Snackbar 节点。
 */
export function PaperSnackbar(props: IPaperSnackbarProps) {
  const { visible, message, onDismiss, actionLabel, onAction, duration, testID } = props;

  return (
    <Snackbar
      action={actionLabel && onAction ? { label: actionLabel, onPress: onAction } : undefined}
      duration={duration}
      onDismiss={onDismiss}
      testID={testID}
      visible={visible}
    >
      {message}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
