import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '@/shared/security/content-security-policy';

describe('buildContentSecurityPolicy', () => {
  it('生产环境用 nonce 且不含 script 的 unsafe-inline', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc123', isDevelopment: false });

    expect(policy).toContain("script-src 'self' 'nonce-abc123'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(policy).not.toContain('unsafe-eval');
  });

  it('开发环境保留 unsafe-inline 与 unsafe-eval', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc123', isDevelopment: true });

    expect(policy).toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(policy).toMatch(/script-src[^;]*'unsafe-eval'/u);
  });

  it('不同 nonce 产出不同策略', () => {
    const first = buildContentSecurityPolicy({ nonce: 'nonce-one', isDevelopment: false });
    const second = buildContentSecurityPolicy({ nonce: 'nonce-two', isDevelopment: false });

    expect(first).not.toBe(second);
  });

  it('style-src 保留 unsafe-inline（antd cssinjs 运行时注入）', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc123', isDevelopment: false });

    expect(policy).toMatch(/style-src[^;]*'unsafe-inline'/u);
  });

  it('固定带上 base-uri / object-src / frame-ancestors', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc123', isDevelopment: false });

    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
