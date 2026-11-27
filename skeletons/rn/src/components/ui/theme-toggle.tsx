import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme, useThemeTokens } from '@theme/theme-provider';
import type { ThemePreference } from '@theme/theme-tokens';

import { AppText } from './app-text';

/**
 * 主题偏好切换顺序：亮 → 暗 → 跟随系统 → 亮。
 */
const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

/**
 * 当前偏好的字形提示；不依赖图标库，原生字体即可渲染。
 */
const GLYPHS: Record<ThemePreference, string> = {
  light: '☀',
  dark: '☾',
  system: '◐',
};

interface IThemeToggleProps {
  /** 无障碍名称；由调用方按当前语言传入，UI primitive 不依赖 i18n。 */
  label: string;
  /** 测试标识。 */
  testID?: string;
}

/**
 * 主题切换控件：在亮色、暗色、跟随系统之间循环，并持久化用户选择。
 *
 * @param props - 无障碍名称与测试标识。
 * @returns 主题切换按钮。
 */
export function ThemeToggle({ label, testID = 'theme-toggle' }: IThemeToggleProps) {
  const { themePreference, setThemePreference } = useAppTheme();
  const tokens = useThemeTokens();
  const handlePress = useCallback(() => {
    setThemePreference(NEXT_PREFERENCE[themePreference]);
  }, [setThemePreference, themePreference]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={handlePress}
      style={[
        styles.button,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.sm,
        },
      ]}
      testID={testID}
    >
      <AppText tone="secondary" variant="body" weight="medium">
        {GLYPHS[themePreference]}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
});
