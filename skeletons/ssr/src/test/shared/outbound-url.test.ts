import { describe, expect, it } from 'vitest';

import { isPrivateHostname, resolveOutboundUrl } from '@/shared/security/outbound-url';

const BASE = 'https://api.example.com';

describe('resolveOutboundUrl', () => {
  it('拼接同源相对路径', () => {
    expect(resolveOutboundUrl(BASE, '/showcase', { allowPrivateNetwork: false })).toBe(
      'https://api.example.com/showcase',
    );
  });

  it('保留查询参数', () => {
    expect(resolveOutboundUrl(BASE, '/orders?status=pending', { allowPrivateNetwork: false })).toBe(
      'https://api.example.com/orders?status=pending',
    );
  });

  it.each([
    '//evil.example/steal',
    'https://evil.example/steal',
    'http://evil.example/steal',
    'javascript:alert(1)',
    'data:text/html,x',
  ])('拒绝跨源或非 http(s) 目标 %s', (path) => {
    expect(() => resolveOutboundUrl(BASE, path, { allowPrivateNetwork: false })).toThrow(/Outbound URL/u);
  });

  it('拒绝带凭证的地址', () => {
    expect(() => resolveOutboundUrl('https://user:pass@api.example.com', '/x', { allowPrivateNetwork: false })).toThrow(
      /credentials/u,
    );
  });

  it('生产拒绝私网与环回目标', () => {
    expect(() => resolveOutboundUrl('http://127.0.0.1:4011', '/showcase', { allowPrivateNetwork: false })).toThrow(
      /private network/u,
    );
  });

  it('mock/开发允许私网目标', () => {
    expect(resolveOutboundUrl('http://127.0.0.1:4011', '/showcase', { allowPrivateNetwork: true })).toBe(
      'http://127.0.0.1:4011/showcase',
    );
  });

  it('拒绝非 http(s) 的 base', () => {
    expect(() => resolveOutboundUrl('ftp://api.example.com', '/x', { allowPrivateNetwork: true })).toThrow(
      /base URL protocol/u,
    );
  });
});

describe('isPrivateHostname', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.1',
    '172.16.0.1',
    '172.31.255.255',
    '169.254.169.254',
    'metadata.google.internal',
    'printer.local',
  ])('把 %s 判为私网', (host) => {
    expect(isPrivateHostname(host)).toBe(true);
  });

  it.each(['api.example.com', 'example.com', '172.32.0.1', '8.8.8.8'])('把 %s 判为公网', (host) => {
    expect(isPrivateHostname(host)).toBe(false);
  });
});
