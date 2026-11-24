import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useHomeSummary } from '@/components/home/use-home-summary';
import { Screen } from '@/components/ui/screen';
import { tokens } from '@/theme/tokens';

/**
 * 工作台首页：三态渲染 + 列表。
 *
 * @returns 首页节点。
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useHomeSummary();

  if (isPending) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator animating />
          <Text style={styles.muted}>{t('home.loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>{t('home.error')}</Text>
          <Button mode="contained" onPress={() => void refetch()}>
            {t('home.retry')}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={data.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text variant="titleLarge">{data.title}</Text>}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>{t('home.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              <Text style={styles.muted}>{item.status}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: tokens.spacing.sm,
    justifyContent: 'center',
  },
  list: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  card: {
    borderRadius: tokens.radius.md,
  },
  muted: {
    color: tokens.color.textMuted,
  },
  error: {
    color: tokens.color.danger,
  },
});
