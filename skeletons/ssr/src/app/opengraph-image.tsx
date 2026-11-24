import { ImageResponse } from 'next/og';

import { OG_IMAGE_DEFAULT_ALT, OG_IMAGE_SIZE, OG_IMAGE_TYPE } from '@/shared/seo/og-image';

/**
 * 社交分享图替代文本。
 *
 * 文件约定的 `alt` 只能是静态命名导出(Next 在构建期读取),无法按请求语言切换,所以这里只放语言无关的
 * 兜底值;公开页由 `buildPublicOpenGraph()` 传入本地化站点名,不复用这个值。
 */
export const alt = OG_IMAGE_DEFAULT_ALT;

/**
 * Open Graph 推荐画布尺寸;与公开页 metadata 共用一个事实源,避免两处尺寸漂移。
 */
export const size = OG_IMAGE_SIZE;

/**
 * 社交图响应格式。
 */
export const contentType = OG_IMAGE_TYPE;

/**
 * 生成不依赖外部资源的默认社交分享图，避免新环境上线时出现空白预览。
 *
 * @returns Open Graph 图片响应。
 */
export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#102a2a',
        color: '#f7f8fa',
        padding: '72px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: 30 }}>
        <div style={{ width: 64, height: 12, background: '#20a486' }} />
        <span>SSR / BFF APPLICATION FOUNDATION</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ fontSize: 82, fontWeight: 700 }}>SSR Application</div>
        <div style={{ fontSize: 34, color: '#b8d8d0' }}>Server-rendered, contract-driven, production-oriented.</div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {['Next.js 16', 'React 19', 'App Router', 'OpenAPI'].map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              border: '2px solid #6ea99a',
              padding: '12px 18px',
              fontSize: 24,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
