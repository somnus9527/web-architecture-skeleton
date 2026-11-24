import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ShowcasePanel } from './showcase-panel';

import type { IShowcaseListViewModel } from '@/bff/adapter/showcase-adapter';
import { PublicLocaleSwitcher } from '@/features/locale-switcher/public-locale-switcher';

/**
 * showcase 首页编排层（Server Component）。保留服务端职责（文案/结构），
 * 把交互与 MUI-heavy 渲染下沉到 Client 叶子 `ShowcasePanel`。
 *
 * @param props - 已适配的展示模型。
 * @returns 首页主内容区。
 */
export async function ShowcasePage({ model }: { model: IShowcaseListViewModel }) {
  const t = await getTranslations('showcase');

  return (
    <Container maxWidth="md" component="main">
      <Stack spacing={2} sx={{ py: 6 }}>
        {/* 标题区提供公开页语言切换（换 URL）；控件用 useSearchParams，必须包 Suspense。 */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h3" component="h1">
            {t('title')}
          </Typography>
          <Suspense fallback={null}>
            <PublicLocaleSwitcher />
          </Suspense>
        </Stack>
        <Typography color="text.secondary">{t('subtitle')}</Typography>
        <ShowcasePanel items={model.items} isEmpty={model.isEmpty} />
      </Stack>
    </Container>
  );
}
