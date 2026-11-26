import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafeHtml } from '@/shared/security/safe-html';

describe('SafeHtml', () => {
  it('keeps safe markup and removes script/event-handler payloads', async () => {
    const { container } = render(
      <SafeHtml html={'<p>safe</p><img src="x" onerror="alert(1)"><script>alert(2)</script>'} />,
    );

    await waitFor(() => {
      expect(screen.getByText('safe')).toBeInTheDocument();
    });

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('removes javascript: URLs', async () => {
    const { container } = render(<SafeHtml html={'<a href="javascript:alert(1)">link</a>'} />);

    await waitFor(() => {
      expect(screen.getByText('link')).toBeInTheDocument();
    });

    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
  });
});
