import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { Text } from 'react-native';

import { ThemeProvider, useAppTheme } from '@theme/theme-provider';

/**
 * 无显式初始偏好的 Provider，用于验证启动水合。
 *
 * @param props - 子树。
 * @returns Theme Provider。
 */
function HydratingProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('should resolve an explicit preference without touching storage', async () => {
    const { result } = await renderHook(() => useAppTheme(), {
      wrapper: ({ children }) => <ThemeProvider initialPreference="dark">{children}</ThemeProvider>,
    });

    expect(result.current.themePreference).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should resolve system preference against the device scheme', async () => {
    const { result } = await renderHook(() => useAppTheme(), {
      wrapper: ({ children }) => <ThemeProvider initialPreference="system">{children}</ThemeProvider>,
    });

    expect(result.current.themePreference).toBe('system');
    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
  });

  it('should hydrate the stored preference on startup', async () => {
    await AsyncStorage.setItem('app-theme-preference', 'dark');

    const { result } = await renderHook(() => useAppTheme(), { wrapper: HydratingProvider });

    await waitFor(() => {
      expect(result.current.themePreference).toBe('dark');
    });
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should keep the system default when nothing is stored', async () => {
    const { result } = await renderHook(() => useAppTheme(), { wrapper: HydratingProvider });

    await waitFor(() => {
      expect(result.current.themePreference).toBe('system');
    });
  });

  it('should persist explicit changes', async () => {
    const { result } = await renderHook(() => useAppTheme(), {
      wrapper: ({ children }) => <ThemeProvider initialPreference="light">{children}</ThemeProvider>,
    });

    await act(async () => {
      result.current.setThemePreference('dark');
    });

    expect(result.current.themePreference).toBe('dark');

    await waitFor(async () => {
      await expect(AsyncStorage.getItem('app-theme-preference')).resolves.toBe('dark');
    });
  });

  it('should throw when used outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    function Probe() {
      useAppTheme();
      return null;
    }

    class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false };

      static getDerivedStateFromError() {
        return { failed: true };
      }

      render() {
        return this.state.failed ? <Text>boundary-failed</Text> : this.props.children;
      }
    }

    await render(
      <Boundary>
        <Probe />
      </Boundary>,
    );

    expect(screen.getByText('boundary-failed')).toBeTruthy();
  });
});
