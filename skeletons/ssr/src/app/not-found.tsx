import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';
import { LinkButton } from '@/shared/ui/link-button';

/**
 * 404 文档的 title：不设的话会继承根 layout 的站点名，比「页面未找到」更不像 404。
 *
 * 不动 `robots`：`noindex` 由 Next 按 404 状态码自动注入，这里再写一次会产出两条 robots meta。
 *
 * @returns 404 页 Metadata。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors.pages.notFound');

  return { title: t('title') };
}

/**
 * 根级 404 页（Server Component）：承运**路由层未命中**，也就是本项目里唯一敢用的 404 形态。
 *
 * 路由层未命中（`/fr`、`/whatever`、`/_foo` 这类非法首段被 `src/proxy.ts` 改写成匹配不到路由的哨兵路径，
 * 以及 `/en-US/<未登记路径>`）会渲染合成路由 `/_not-found`：Next 在这里套上根 layout，`<html lang>`、MUI
 * 主题与应用样式表都由根 layout 提供，`noindex` 由 Next 按 404 状态码自动注入，因此本文件不需要自带
 * `<html>`/`<body>`。**只有这条链能同时拿到 `404` 状态码与服务端直出的完整文档**。
 *
 * 因此公开区不抛 `notFound()`（实测于 Next 16.2 standalone 生产构建，三种形态对比）：
 * 抛 `notFound()` 不给 Suspense 边界 → 状态码 404 但文档退化成 Next 内置错误壳
 * （`<html id="__next_error__">`：无 `lang`、服务端 body 为空，404 UI 只在 hydration 后出现）；给了 Suspense
 * 边界（如 `[locale]/loading.tsx`）→ 文档保住 app shell，但**状态码退化成 200**（软 404，比错误壳更糟）。
 * 两者都不能要，所以 404 一律走路由层未命中，不再有「抛 notFound()」这条链。
 *
 * 不用 `experimental.globalNotFound`：该开关会在构建期摘掉 `/_not-found` 的根 layout，把文档换成一份
 * 自包含的 `global-not-found.tsx`，反而丢掉上面这些；见 `next.config.ts` 的说明。
 *
 * 返回首页链接按当前解析出的 locale 直接指向语言 URL，避免多一次 308 跳转或语言跳变。语言来自 URL 语言段
 * （proxy 注入的受控头），所以 `/en-US/<未登记路径>` 的 404 也是英文。
 *
 * @returns 未找到提示与返回公开首页链接。
 */
export default async function NotFound() {
  const locale = toLocaleCode(await getLocale());
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
          href={localizedPath(locale, '/')}
          hrefLang={locale}
          sx={{ mt: 1.5, bgcolor: 'text.primary', color: 'background.paper', '&:hover': { bgcolor: 'text.secondary' } }}
        >
          {t('backHome')}
        </LinkButton>
      </Stack>
    </Box>
  );
}
