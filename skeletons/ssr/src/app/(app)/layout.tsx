import type { ReactNode } from 'react';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * 登录后工具区布局。页面自行声明 dynamic/no-store 和鉴权方式。
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
