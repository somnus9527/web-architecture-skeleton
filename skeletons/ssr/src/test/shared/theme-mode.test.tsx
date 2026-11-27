import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeModeProvider } from '@/shared/theme/theme-mode-provider';
import { useThemeMode } from '@/shared/theme/theme-mode-context';
import {
  applyResolvedTheme,
  parseThemeMode,
  readStoredThemeMode,
  resolveTheme,
  storeThemeMode,
  systemPrefersDark,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  toggleExplicitTheme,
} from '@/shared/theme/theme-mode';

/**
 * 用可控的 matchMedia 替身模拟系统深色偏好。
 *
 * @param matches - 当前是否偏好深色。
 * @returns 可用于派发 change 事件的监听器集合。
 */
function stubMatchMedia(matches: boolean): { dispatch: (next: boolean) => void } {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => listeners.add(handler),
      removeEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => listeners.delete(handler),
    })),
  );

  return {
    dispatch: (next) => {
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});

describe('theme-mode 基础逻辑', () => {
  it('should parse only supported modes', () => {
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
    expect(parseThemeMode('system')).toBe('system');
    expect(parseThemeMode('DARK')).toBeUndefined();
    expect(parseThemeMode('')).toBeUndefined();
    expect(parseThemeMode(null)).toBeUndefined();
    expect(parseThemeMode(undefined)).toBeUndefined();
  });

  it('should resolve system mode against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('should toggle between explicit light and dark', () => {
    expect(toggleExplicitTheme('light')).toBe('dark');
    expect(toggleExplicitTheme('dark')).toBe('light');
  });

  it('should read and persist the stored mode in localStorage and cookie', () => {
    expect(readStoredThemeMode()).toBeUndefined();

    storeThemeMode('dark');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
    expect(readStoredThemeMode()).toBe('dark');
  });

  it('should degrade when localStorage throws', () => {
    const original = window.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });

    expect(readStoredThemeMode()).toBeUndefined();
    expect(() => storeThemeMode('light')).not.toThrow();

    vi.stubGlobal('localStorage', original);
  });

  it('should detect the system preference and survive missing matchMedia', () => {
    expect(systemPrefersDark()).toBe(false);

    stubMatchMedia(true);
    expect(systemPrefersDark()).toBe(true);

    vi.stubGlobal('matchMedia', undefined);
    expect(systemPrefersDark()).toBe(false);
  });

  it('should apply the resolved theme to the document', () => {
    applyResolvedTheme('dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});

describe('ThemeModeProvider', () => {
  it('should start from the SSR-provided mode and apply it', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useThemeMode(), {
      wrapper: ({ children }) => <ThemeModeProvider initialMode="dark">{children}</ThemeModeProvider>,
    });

    expect(result.current.mode).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('should follow the system preference while mode is system', () => {
    const media = stubMatchMedia(false);

    const { result } = renderHook(() => useThemeMode(), {
      wrapper: ({ children }) => <ThemeModeProvider>{children}</ThemeModeProvider>,
    });

    expect(result.current.resolved).toBe('light');

    act(() => media.dispatch(true));

    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('should persist explicit mode changes', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useThemeMode(), {
      wrapper: ({ children }) => <ThemeModeProvider initialMode="light">{children}</ThemeModeProvider>,
    });

    act(() => result.current.setMode('dark'));

    expect(result.current.mode).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('should throw when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useThemeMode())).toThrow('useThemeMode 必须在 ThemeModeProvider 内使用。');
  });
});
