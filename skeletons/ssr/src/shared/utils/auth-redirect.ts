import { redirectToInternalPath } from '@/shared/security/safe-redirect';

const LOGIN_PATH = '/login';

/**
 * BFF 返回 401 时跳转登录页。
 *
 * 跳转本身收敛在 `redirectToInternalPath()`（`shared/security/safe-redirect.ts`）里，
 * 既复用了站内白名单校验，也让「重定向唯一出口」这条扫描规则成立。
 *
 * @param response - 同源 BFF 响应。
 * @returns 已触发跳转时返回 true。
 */
export function redirectToLoginOnUnauthorized(response: Response): boolean {
  if (response.status !== 401) {
    return false;
  }

  return redirectToInternalPath(LOGIN_PATH, LOGIN_PATH) !== null;
}
