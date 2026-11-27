/* global window, document */
/*
 * 首屏主题引导：在样式与 React 之前把 <html data-theme> 设成用户实际主题，避免深色用户看到白屏闪烁。
 *
 * 与 src/shared/theme/theme-mode.ts 共用同一个 localStorage 键；逻辑必须保持同步。
 * 这是外部脚本（CSP `script-src 'self'` 允许），不放 inline script，避免放宽 CSP。
 */
(function bootstrapTheme() {
  try {
    var readCookie = function (name) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    };
    var stored = window.localStorage.getItem('app-theme-mode') || readCookie('app-theme-mode');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var prefersDark =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
    var root = document.documentElement;

    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch {
    /* 隐私模式或禁用存储时保持默认浅色，不影响页面可用性。 */
  }
})();
