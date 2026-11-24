import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getServerConfig } from '@/bff/shared/server-config';

export const dynamic = 'force-dynamic';

/**
 * 登录后工具区占位页。只验证 cookie 存在性，不把 token 暴露给 UI。
 *
 * @returns 认证区占位内容。
 */
export default async function ShowcaseConsolePage() {
  const config = getServerConfig();
  const cookieStore = await cookies();

  if (!cookieStore.get(config.sessionCookieName)?.value) {
    redirect('/login');
  }

  const t = await getTranslations('console');

  return (
    <Container maxWidth="sm" component="main">
      <Stack spacing={2} sx={{ py: 8 }}>
        <Typography variant="h4" component="h1">
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('description')}</Typography>
      </Stack>
    </Container>
  );
}
