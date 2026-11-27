import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseThemePreference, type ThemePreference } from '@theme/theme-tokens';

/**
 * 主题偏好的持久化键；非敏感数据，按 storage 规则进 AsyncStorage。
 */
const THEME_PREFERENCE_KEY = 'app-theme-preference';

/**
 * 读取已保存的主题偏好。
 *
 * @returns 合法偏好；没有保存、读取失败或值非法时返回 null。
 */
export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    return parseThemePreference(await AsyncStorage.getItem(THEME_PREFERENCE_KEY));
  } catch {
    // 存储不可用时回落到系统主题，不阻塞启动。
    return null;
  }
}

/**
 * 保存主题偏好。
 *
 * @param preference - 用户选择的偏好。
 * @returns 写入完成的 Promise；失败时静默，主题仍在本次会话内生效。
 */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // 存储写入失败不影响当前会话的主题切换。
  }
}
