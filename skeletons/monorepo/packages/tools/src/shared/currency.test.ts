import { describe, expect, it } from 'vitest';

import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('should format CNY amounts for the default locale', () => {
    expect(formatCurrency(1288)).toBe('¥1,288.00');
  });

  it('should follow the requested locale', () => {
    expect(formatCurrency(10, 'en-US')).toBe('CN¥10.00');
  });
});
