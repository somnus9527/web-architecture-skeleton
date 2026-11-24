import type { MetadataRoute } from 'next';

/**
 * 生成站点 Web App Manifest，为安装入口、主题色和图标提供统一机器可读配置。
 *
 * @returns Web App Manifest。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SSR Application Skeleton',
    short_name: 'SSR App',
    description: 'A production-oriented SSR and BFF application foundation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#176b5b',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
