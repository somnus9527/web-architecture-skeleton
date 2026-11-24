'use client';

import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';

/**
 * 路由段错误边界。仅提供恢复入口，不暴露堆栈（引导用 request id 排查）。
 *
 * @param props - Next 注入的 reset 回调（error 对象故意不消费以免泄漏细节）。
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors.pages.routeUnavailable');

  return (
    <Container maxWidth="sm">
      <Stack spacing={2} sx={{ py: 8, alignItems: 'flex-start' }}>
        <Typography variant="h5" component="h1">
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('description')}</Typography>
        <Button variant="contained" onClick={reset}>
          {t('retry')}
        </Button>
      </Stack>
    </Container>
  );
}
