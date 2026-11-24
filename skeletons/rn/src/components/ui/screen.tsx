import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import type { PropsWithChildren } from 'react';

/**
 * 页面容器：统一安全区与页面内边距。
 *
 * @param props - 子节点。
 * @returns 页面容器。
 */
export function Screen({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.container}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
