import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeModeProvider } from '@/shared/theme/theme-mode-provider';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

describe('ThemeToggle', () => {
  it('should expose an accessible name and switch between light and dark', () => {
    render(
      <ThemeModeProvider initialMode="light">
        <ThemeToggle label="切换主题" />
      </ThemeModeProvider>,
    );

    const button = screen.getByRole('button', { name: '切换主题' });

    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
