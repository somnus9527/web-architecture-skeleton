// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));

/**
 * 读取 App Router 基础设施文件，供 SEO 静态边界断言复用。
 *
 * @param relativePath - 相对 `src/app` 的文件路径。
 * @returns 文件文本。
 */
function readAppFile(relativePath: string): string {
  return readFileSync(`${APP_DIR}/${relativePath}`, 'utf8');
}

describe('SEO infrastructure boundary', () => {
  it('包含基础 metadata 文件路由', () => {
    for (const file of ['robots.ts', 'sitemap.ts', 'manifest.ts', 'icon.svg', 'opengraph-image.tsx']) {
      expect(existsSync(`${APP_DIR}/${file}`), `缺少 SEO 基础设施文件: ${file}`).toBe(true);
    }
  });

  it('根 layout 提供站点级 metadata，公开页提供语言相关 metadata', () => {
    const layout = readAppFile('layout.tsx');
    const page = readAppFile('[locale]/page.tsx');

    expect(layout).toContain('metadataBase');
    expect(layout).toContain('applicationName');
    expect(page).toContain('getShowcaseListForHomeService');
    expect(page).toContain('buildPublicAlternates');
    expect(page).toContain('buildPublicOpenGraph');
  });

  it('社交卡片整套启用或整套退出，不得停在半成品', () => {
    const hasOgImage = existsSync(`${APP_DIR}/opengraph-image.tsx`);
    const layout = readAppFile('layout.tsx');

    // 档位自洽：图片文件、根 layout 的 openGraph、twitter.card 三者必须同进同出。
    // 只声明 `twitter: card: 'summary_large_image'` 却拿不到图，就是「有 card 无图」的半成品卡片。
    expect(hasOgImage, '启用档必须有 opengraph-image.tsx').toBe(/openGraph\s*:/u.test(layout));
    expect(hasOgImage, '启用档必须有 twitter.card').toBe(/card:\s*'summary_large_image'/u.test(layout));

    if (!hasOgImage) {
      return;
    }

    // 启用档下，公开页声明 openGraph 必须走 helper 一次性补齐：Next 的 metadata 是逐字段覆盖、
    // openGraph 整块替换（不深合并），裸写 title/description/locale 会把根 layout 的
    // type/siteName 与文件约定注入的 images 一起静默抹掉（见 seo.md「社交卡片」）。
    const page = readAppFile('[locale]/page.tsx');
    expect(page, '公开页 openGraph 必须由 buildPublicOpenGraph() 产出').toMatch(/openGraph:\s*buildPublicOpenGraph\(/u);

    const helper = readAppFile('../shared/seo/public-locale-metadata.ts');
    for (const field of ['type', 'siteName', 'images', 'alternateLocale']) {
      expect(helper, `buildPublicOpenGraph 必须补齐 ${field}`).toContain(field);
    }

    // 图片尺寸/类型是单一事实源：路由文件不得再抄一份字面量。
    expect(readAppFile('opengraph-image.tsx')).toContain('OG_IMAGE_SIZE');
    expect(readAppFile('opengraph-image.tsx'), '尺寸常量必须来自 src/shared/seo/og-image.ts').not.toContain('1200');
  });

  it('认证区和工具区统一 noindex', () => {
    for (const layoutPath of ['(auth)/layout.tsx', '(app)/layout.tsx']) {
      const layout = readAppFile(layoutPath);
      expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*\}/u);
    }
  });

  it('robots 通过登记表屏蔽 Next BFF 前缀', () => {
    const robots = readAppFile('robots.ts');
    expect(robots).toContain('PRIVATE_ROUTE_PREFIXES');
    expect(existsSync(`${APP_DIR}/../shared/navigation/public-route-visibility.ts`)).toBe(true);
  });
});
