import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JsonLd } from '@/shared/security/json-ld';
import { serializeJsonLd } from '@/shared/security/json-ld-serializer';

describe('JsonLd', () => {
  it('escapes markup-sensitive characters', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
    expect(serializeJsonLd({ name: '\u2028\u2029' })).toContain('\\u2028');
  });

  it('renders a valid JSON-LD script without a closing-tag breakout', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Thing', name: '</script>' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(script?.textContent).not.toContain('</script>');
  });
});
