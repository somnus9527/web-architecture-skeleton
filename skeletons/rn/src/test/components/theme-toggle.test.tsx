import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeToggle } from '@components/ui/theme-toggle';
import { TestProviders } from '@test/utils/test-providers';

describe('ThemeToggle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('should expose an accessible name and cycle light → dark → system', async () => {
    await render(
      <TestProviders>
        <ThemeToggle label="切换主题" />
      </TestProviders>,
    );

    fireEvent.press(screen.getByLabelText('切换主题'));
    await waitFor(async () => {
      await expect(AsyncStorage.getItem('app-theme-preference')).resolves.toBe('light');
    });

    fireEvent.press(screen.getByLabelText('切换主题'));
    await waitFor(async () => {
      await expect(AsyncStorage.getItem('app-theme-preference')).resolves.toBe('dark');
    });

    fireEvent.press(screen.getByLabelText('切换主题'));
    await waitFor(async () => {
      await expect(AsyncStorage.getItem('app-theme-preference')).resolves.toBe('system');
    });
  });
});
