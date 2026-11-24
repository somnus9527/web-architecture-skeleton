'use client';

import Button from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 站内链接按钮入参。只接受可序列化值，组件引用留在客户端。
 */
interface ILinkButtonProps {
  /**
   * 站内目标地址。
   */
  href: string;
  /**
   * 目标语言标记（`hreflang`），供爬虫关联多语言版本。
   */
  hrefLang?: string;
  /**
   * 由调用方（Server Component）传入的 MUI 样式覆盖。
   */
  sx?: SxProps<Theme>;
  /**
   * 按钮文案。
   */
  children: ReactNode;
}

/**
 * 站内链接按钮（Client 叶子）。
 *
 * **为什么必须是一个 Client 组件**：MUI `Button` 是 Client Component，而 `component={Link}` 传的是**函数
 * 引用**。Server Component 里直接这么写会在序列化时报
 * `Functions cannot be passed directly to Client Components`（Next 16.2 实测：路由层 404 会因此从 404 变
 * 500）。把组件引用留在客户端、只接收可序列化 props，既保住 MUI 外观，也保住 `next/link` 的站内导航
 * （`docs/rules/frontend/ssr-routing-and-rsc.md` 要求站内跳转用 `next/link`，不得退化成普通 `<a href>`）。
 *
 * @param props - 链接地址、语言标记、样式与按钮文案。
 * @returns 以 `next/link` 为宿主的 MUI 按钮。
 */
export function LinkButton({ href, hrefLang, sx, children }: ILinkButtonProps) {
  return (
    <Button component={Link} href={href} hrefLang={hrefLang} variant="contained" sx={sx}>
      {children}
    </Button>
  );
}
