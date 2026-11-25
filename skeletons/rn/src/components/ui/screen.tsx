import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeTokens } from '@theme/theme-provider';

interface IScreenProps {
  /** 页面内容。 */
  children: ReactNode;
  /** 是否参与顶部安全区，默认 true。 */
  includeTopInset?: boolean;
  /** 测试标识。 */
  testID?: string;
}

/**
 * Screen 外壳：统一安全区与页面背景色。
 *
 * @param props - 页面属性。
 * @returns 页面容器。
 */
export function Screen({ children, includeTopInset = true, testID }: IScreenProps) {
  const tokens = useThemeTokens();

  return (
    <SafeAreaView
      edges={includeTopInset ? (['top', 'bottom'] as const) : (['bottom'] as const)}
      style={[styles.container, { backgroundColor: tokens.colors.surface }]}
      testID={testID}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
