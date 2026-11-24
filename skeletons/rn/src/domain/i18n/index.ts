import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from '@/domain/i18n/locales/en-US.json';
import zhCN from '@/domain/i18n/locales/zh-CN.json';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;

/**
 * 独立 i18n 实例，避免直接使用默认导出的成员函数。
 */
export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});
