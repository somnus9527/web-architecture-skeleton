import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './en-US.json';
import zhCN from './zh-CN.json';

/**
 * 当前 SPA 支持的语言编码。
 */
export type LocaleCode = 'zh-CN' | 'en-US';

const DEFAULT_LOCALE: LocaleCode = 'zh-CN';

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  interpolation: {
    escapeValue: false,
  },
  initAsync: false,
});

/**
 * 读取 i18n 文案，并在 key 缺失时返回 key 以暴露配置问题。
 *
 * @param key - 文案资源中的稳定 key。
 * @returns 当前语言下的用户可见文案。
 */
export function t(key: string): string {
  return i18n.t(key);
}

export { i18n };
