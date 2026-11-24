'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';

import type { IShowcaseItemViewModel } from '@/bff/adapter/showcase-adapter';

/**
 * showcase 列表 Client 叶子。仅消费已序列化的 view model props，
 * 不 import 任何 `@/bff` 运行时（类型除外）。
 *
 * @param props - 展示条目与空态标记。
 * @returns 列表 UI。
 */
export function ShowcasePanel({ items, isEmpty }: { items: IShowcaseItemViewModel[]; isEmpty: boolean }) {
  const t = useTranslations('showcase');

  if (isEmpty) {
    return <Typography color="text.secondary">{t('empty')}</Typography>;
  }

  return (
    <Stack spacing={2}>
      {items.map((item) => (
        <Card key={item.id} variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
              <Typography variant="h6" component="h2">
                {item.title}
              </Typography>
              <Chip label={item.category} size="small" />
            </Stack>
            <Typography color="text.secondary">{item.summary}</Typography>
            <Typography variant="caption" color="text.disabled">
              {item.updatedLabel}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
