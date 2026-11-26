import { describe, expect, it } from 'vitest';

import { redactLogValue, shouldLog } from '@/shared/logger/logger-core';

describe('logger core', () => {
  it('redacts sensitive keys and inline credentials', () => {
    const value = redactLogValue({
      authorization: 'Bearer secret',
      user: { email: 'alice@example.com', phone: '13800138000', id: 'u-1' },
      note: 'contact alice@example.com',
    });

    expect(value).toEqual({
      authorization: '[redacted]',
      user: { email: '[redacted]', phone: '[redacted]', id: 'u-1' },
      note: '[redacted]',
    });
  });

  it('filters levels by threshold', () => {
    expect(shouldLog('info', 'info')).toBe(true);
    expect(shouldLog('debug', 'info')).toBe(false);
    expect(shouldLog('error', 'warn')).toBe(true);
  });
});
