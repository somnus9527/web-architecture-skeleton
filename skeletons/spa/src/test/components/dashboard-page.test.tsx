import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Component as DashboardPage } from '@/features/workspace/pages/dashboard-page';

/**
 * 渲染工作台页面并等待 API 不可用错误态出现。
 */
async function renderDashboard(): Promise<void> {
  render(<DashboardPage />);

  await waitFor(() => {
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
  });
}

describe('DashboardPage', () => {
  it('should render a clear error state when the mock API server is unavailable', async () => {
    await renderDashboard();

    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
  });
});
