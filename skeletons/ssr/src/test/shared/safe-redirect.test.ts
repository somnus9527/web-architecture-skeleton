import { describe, expect, it } from 'vitest';

import { safeRedirect } from '@/shared/security/safe-redirect';

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
