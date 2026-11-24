import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/features/locale-switcher/locale-switcher';
import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';

/**
 * 受控登录占位页，不伪造真实认证能力。
 *
 * 非公开区语言切换保持 cookie + `router.refresh()`（URL 不带语言前缀）；返回首页链接直接指向当前
 * 语言 URL，避免多一次 308 跳转或语言跳变。
 *
 * @returns 登录占位内容。
 */
export default async function LoginPage() {
  const t = await getTranslations('auth');
  const locale = toLocaleCode(await getLocale());

  return (
    <Container maxWidth="sm" component="main">
      <Stack spacing={2} sx={{ py: 8 }}>
        <Typography variant="h4" component="h1">
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('description')}</Typography>
        <LocaleSwitcher />
        <Link href={localizedPath(locale, '/')} hrefLang={locale}>
          {t('backHome')}
        </Link>
      </Stack>
    </Container>
  );
}
