/**
 * 重新加载当前浏览器页面，使旧客户端完整获取新版本 HTML、RSC、JS 与 CSS。
 */
export function reloadBrowserPage(): void {
  window.location.reload();
}
