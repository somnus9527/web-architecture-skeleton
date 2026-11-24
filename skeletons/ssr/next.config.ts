import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const isProductionApp = process.env.APP_ENV === 'prod';
const isProductionMode = process.env.NODE_ENV === 'production';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const deploymentVersion = process.env.NEXT_DEPLOYMENT_ID?.trim();

if (isProductionMode && !deploymentVersion) {
  throw new Error('Missing production deployment version. Build Next through scripts/run-next-with-env.mjs.');
}

/**
 * Next.js SSR/BFF 单应用基线配置。
 *
 * - `output: 'standalone'` 产出自包含服务，配合 `scripts/copy-standalone-assets.mjs` 满足无 CDN 部署。
 * - `turbopack.root` 固定项目根目录，避免上级 lockfile 扩大监听范围并触发异常刷新。
 * - production 构建必须固化 release id；development 不要求版本变量，也不启用自动刷新。
 * - 生产构建移除非 error/warn 的 console，避免泄漏与噪声。
 * - 不开 `experimental.globalNotFound`：该开关会在构建期把 `/_not-found` 路由的**根 layout 摘掉**，换成
 *   `src/app/global-not-found.tsx` 那份自包含文档，反而丢掉根 layout 提供的 `<html lang>` 与应用样式
 *   （MUI 主题、字体）。路由层 404 与组件内 `notFound()` 统一由 `src/app/not-found.tsx` 承运。只有改成
 *   多 root layout（`[locale]` 自带 `<html>`、删除 `src/app/layout.tsx`）时才需要重新评估这个开关。
 * - `images.remotePatterns` 仅为占位示例，接入真实媒体域名时按需扩展白名单。
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  deploymentId: deploymentVersion,
  env: {
    NEXT_PUBLIC_DEPLOYMENT_VERSION: deploymentVersion ?? 'development',
  },
  turbopack: {
    root: process.cwd(),
  },
  compiler: {
    removeConsole: isProductionApp ? { exclude: ['error', 'warn'] } : false,
  },
  typescript: {
    tsconfigPath: process.env.NODE_ENV === 'production' ? 'tsconfig.build.json' : 'tsconfig.json',
  },
  images: {
    // 骨架默认允许宽泛 hostname 以便复制后可运行；正式应用必须替换为显式白名单。
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
