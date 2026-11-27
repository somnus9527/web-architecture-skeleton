/**
 * 主题模式的跨变体基础逻辑：解析、持久化、应用到 `<html data-theme>`。
 *
 * 读写都做了 SSR / 隐私模式保护：没有 `window` / `document` / `localStorage` 时降级为默认值，
 * 不让主题逻辑成为渲染阻塞点。
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage 键；`public/theme-bootstrap.js` 读同一个键。 */
export const THEME_STORAGE_KEY = 'app-theme-mode';

/** cookie 名；SSR 用它把用户选择带到服务端渲染，避免首屏主题抖动。 */
export const THEME_COOKIE_NAME = 'app-theme-mode';

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

/**
 * 把任意字符串收敛为受支持的 ThemeMode。
 *
 * @param value - 本地存储、cookie 或 URL 里的原始值。
 * @returns 受支持的模式；非法值返回 undefined。
 */
export function parseThemeMode(value: string | null | undefined): ThemeMode | undefined {
  return value && (THEME_MODES as readonly string[]).includes(value) ? (value as ThemeMode) : undefined;
}

/**
 * 读取本地存储中的主题选择。
 *
 * @returns 已保存的模式；没有或不可读时返回 undefined。
 */
export function readStoredThemeMode(): ThemeMode | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/**
 * 持久化主题选择：localStorage 供 bootstrap 首屏读取，cookie 供 SSR 服务端渲染。
 *
 * @param mode - 用户选择的模式。
 */
export function storeThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // 隐私模式下 localStorage 可能不可写；主题仍然在本次会话内生效。
  }

  document.cookie = `${THEME_COOKIE_NAME}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * 读取系统深色偏好。
 *
 * @returns 系统是否偏好深色；无 matchMedia（如 jsdom）时返回 false。
 */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 把主题模式解析成实际生效的主题。
 *
 * @param mode - 用户选择的模式。
 * @param prefersDark - 系统当前是否偏好深色。
 * @returns 实际生效的 `light` / `dark`。
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light';
  }

  return mode;
}

/**
 * 把实际主题写到 `<html>` 上，同时同步 `color-scheme` 以影响原生控件滚动条。
 *
 * @param resolved - 实际生效的主题。
 */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/**
 * 在明暗之间切换（system 视为当前实际主题，切一次即变成显式模式）。
 *
 * @param resolved - 当前实际生效的主题。
 * @returns 切换后的显式模式。
 */
export function toggleExplicitTheme(resolved: ResolvedTheme): ResolvedTheme {
  return resolved === 'dark' ? 'light' : 'dark';
}
