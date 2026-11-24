'use client';

import zhCN from '@/locale/zh-CN.json';

/**
 * 根级错误边界。触发时根 layout 可能已失效，因此渲染完整 `<html><body>`，
 * 且直接读取 zh-CN 文案（此时 next-intl provider 可能不可用）。
 *
 * @param props - Next 注入的 reset 回调。
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const copy = zhCN.errors.pages.globalUnavailable;

  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px' }}>
          <h1 style={{ fontSize: 20 }}>{copy.title}</h1>
          <p style={{ color: '#6b7280' }}>{copy.description}</p>
          <button type="button" onClick={reset} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
