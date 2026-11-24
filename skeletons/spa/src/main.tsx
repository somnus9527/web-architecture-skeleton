import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { appEnv } from '@/shared/config/app-env';

import '@/locale';
import './styles.css';

/**
 * 挂载 React 根节点；全局 Provider 与错误兜底由 App 统一装配。
 */
function bootstrapApp(): void {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element #root is missing.');
  }

  document.title = appEnv.appTitle;
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrapApp();
