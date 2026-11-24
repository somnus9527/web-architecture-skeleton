import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from '@/domain/i18n/locales/en-US.json';
import zhCN from '@/domain/i18n/locales/zh-CN.json';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

export { i18n };
