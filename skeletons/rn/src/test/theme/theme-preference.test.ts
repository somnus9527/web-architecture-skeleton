import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadThemePreference, saveThemePreference } from '@storage/theme-preference';

describe('theme preference storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('should return null when nothing is stored', async () => {
    await expect(loadThemePreference()).resolves.toBeNull();
  });

  it('should round-trip a supported preference', async () => {
    await saveThemePreference('dark');

    await expect(loadThemePreference()).resolves.toBe('dark');
  });

  it('should ignore an unsupported stored value', async () => {
    await AsyncStorage.setItem('app-theme-preference', 'sepia');

    await expect(loadThemePreference()).resolves.toBeNull();
  });

  it('should fall back when reading throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadThemePreference()).resolves.toBeNull();
  });

  it('should swallow write errors', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota'));

    await expect(saveThemePreference('light')).resolves.toBeUndefined();
  });
});
