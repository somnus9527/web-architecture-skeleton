import { describe, expect, it, vi } from 'vitest';

import { redirectToInternalPath, safeRedirect } from '@/shared/security/safe-redirect';

describe('safeRedirect', () => {
  it('keeps same-origin relative paths', () => {
    expect(safeRedirect('/orders?status=pending', '/workspace')).toBe('/orders?status=pending');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'data:text/html,x',
    '/%2f%2fevil.example',
    '/%5cevil.example',
    '  //evil.example',
    null,
    undefined,
  ])('rejects unsafe target %s', (target) => {
    expect(safeRedirect(target, '/workspace')).toBe('/workspace');
  });
});

describe('redirectToInternalPath', () => {
  it('只跳到站内路径，并用 replace 而不是 assign', () => {
    const replace = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { replace } });

    try {
      expect(redirectToInternalPath('/orders?tab=1', '/login')).toBe('/orders?tab=1');
      expect(replace).toHaveBeenCalledWith('/orders?tab=1');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('外站目标回落到 fallback', () => {
    const replace = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { replace } });

    try {
      expect(redirectToInternalPath('//evil.example', '/login')).toBe('/login');
      expect(replace).toHaveBeenCalledWith('/login');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });
});
