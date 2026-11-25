import { StyleSheet, View } from 'react-native';

import { useThemeTokens } from '@theme/theme-provider';

import { AppText } from './app-text';

interface ISectionHeaderProps {
  /** 区块标题。 */
  title: string;
  /** 区块说明。 */
  description?: string;
  /** 测试标识。 */
  testID?: string;
}

/**
 * SectionHeader primitive：区块标题 + 可选说明。
 *
 * @param props - 区块标题属性。
 * @returns 区块标题节点。
 */
export function SectionHeader(props: ISectionHeaderProps) {
  const { title, description, testID } = props;
  const tokens = useThemeTokens();

  return (
    <View style={[styles.container, { gap: tokens.spacing.xs }]} testID={testID}>
      <AppText accessibilityRole="header" numberOfLines={2} tone="primary" variant="title" weight="semibold">
        {title}
      </AppText>
      {description ? (
        <AppText numberOfLines={3} tone="secondary" variant="body">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
});
