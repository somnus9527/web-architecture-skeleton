import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 站内链接按钮入参。
 */
export interface ILinkButtonProps {
  /**
   * 站内目标地址。
   */
  href: string;
  /**
   * 目标语言标记（`hreflang`），供爬虫关联多语言版本。
   */
  hrefLang?: string;
  /**
   * 附加 class，用于布局覆盖。
   */
  className?: string;
  /**
   * 按钮文案。
   */
  children: ReactNode;
}

/**
 * 站内链接按钮：使用 next/link 保留站内导航，外观由原生 CSS 按钮类提供。
 *
 * @param props - 链接地址、语言标记、class 与按钮文案。
 * @returns 站内链接节点。
 */
export function LinkButton({ href, hrefLang, className, children }: ILinkButtonProps) {
  return (
    <Link href={href} hrefLang={hrefLang} className={['aui-link-button', className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}
