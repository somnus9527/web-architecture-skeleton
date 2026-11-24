const LOGIN_PATH = '/login';

/**
 * BFF 返回 401 时跳转登录页。
 *
 * @param response - 同源 BFF 响应。
 * @returns 已触发跳转时返回 true。
 */
export function redirectToLoginOnUnauthorized(response: Response): boolean {
  if (response.status !== 401) {
    return false;
  }

  window.location.assign(LOGIN_PATH);
  return true;
}
