'use client';

import { useEffect, useState } from 'react';

import type { Config } from 'dompurify';

/**
 * 安全富文本参数。
 */
export interface ISafeHtmlProps {
  /**
   * 待渲染的 HTML；调用方不得传入未经服务端校验的原始用户输入。
   */
  html: string;
  /**
   * 外层容器 class；只用于布局，不参与 HTML 内容白名单。
   */
  className?: string;
}

/**
 * 固定的 DOMPurify 配置；不接受调用方覆盖，避免每个 feature 自己决定白名单。
 */
const SANITIZE_OPTIONS: Config = {
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'srcset', 'formaction', 'xlink:href'],
};

/**
 * 唯一允许 `dangerouslySetInnerHTML` 的富文本出口。
 *
 * DOMPurify 只在浏览器端加载，避免把 jsdom 或浏览器专用实现带进 SSR 运行时；
 * 服务端富文本应由 BFF 在进入 RSC 前完成清洗，本组件是客户端兜底。
 *
 * @param props - 富文本参数。
 * @returns 清洗后的富文本容器。
 */
export function SafeHtml({ html, className }: ISafeHtmlProps) {
  const [sanitized, setSanitized] = useState('');

  useEffect(() => {
    let active = true;

    void import('dompurify')
      .then(({ default: DOMPurify }) => {
        if (active) {
          setSanitized(DOMPurify.sanitize(html, SANITIZE_OPTIONS));
        }
      })
      .catch(() => {
        if (active) {
          setSanitized('');
        }
      });

    return () => {
      active = false;
    };
  }, [html]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
