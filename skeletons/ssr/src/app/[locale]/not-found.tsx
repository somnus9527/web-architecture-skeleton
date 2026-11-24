import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getLocale, getTranslations } from 'next-intl/server';

import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';
import { LinkButton } from '@/shared/ui/link-button';

/**
 * 公开区 404 页（Server Component）。
 *
 * 落在语言段内，因此文案与返回首页链接都跟随 URL 语言；不经过 308 跳转，也不切语言。
 *
 * **只有一种请求会走到这里**：这段里组件主动抛出 `notFound()`（当前只有公开页入口的
 * `assertPublicLocaleSegment()` 这一处，它兜的是 proxy matcher 看不见的含点路径）。它的文档形态是 Next
 * 内置错误边界给的那份：状态码 404 正确，但**这个组件是客户端渲染的**（服务端 body 为空，hydration 后才
 * 出现），拿不到 `<html lang>` 与应用样式表。想让它变成服务端直出的文档只能靠 Suspense 边界兜住 shell，
 * 而那条路会把状态码退化成 200（实测），更不可取。
 *
 * 也就是说：**这不是「`/en-US/xxx` 的 404 页」**。`/en-US/<未登记路径>` 是路由层未命中，`/_not-found` 是
 * root 级合成路由，不会进到 `[locale]` 段，那份文档由根级 `src/app/not-found.tsx` 在根 layout 内渲染
 * （Next 自己的规则：URL 未命中时永远是根 `not-found`；「最近优先」只适用于组件抛出的 `notFound()`）。
 *
 * @returns 未找到提示与返回当前语言首页链接。
 */
export default async function PublicNotFound() {
  const urlLocale = toLocaleCode(await getLocale());
  const t = await getTranslations('errors.pages.notFound');

  return (
    <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Stack
        spacing={1.5}
        sx={{ width: '100%', maxWidth: 480, px: 3, py: 8, alignItems: 'center', textAlign: 'center' }}
      >
        <Typography component="p" sx={{ m: 0, fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
          404
        </Typography>
        <Typography variant="h6" component="h1" sx={{ fontSize: 20 }}>
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('description')}</Typography>
        <LinkButton
          href={localizedPath(urlLocale, '/')}
          hrefLang={urlLocale}
          sx={{ mt: 1.5, bgcolor: 'text.primary', color: 'background.paper', '&:hover': { bgcolor: 'text.secondary' } }}
        >
          {t('backHome')}
        </LinkButton>
      </Stack>
    </Box>
  );
}
