import type { ReactNode } from 'react';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * 认证区布局。正式应用替换内部认证流程，但保留 noindex 边界。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
