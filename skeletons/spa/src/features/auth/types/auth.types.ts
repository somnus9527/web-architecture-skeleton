import type { ISessionUser } from '@/shared/store/session-store';

/**
 * 登录请求体。
 */
export interface ILoginRequest {
  /**
   * 业务账号。
   */
  username: string;
  /**
   * 账号密码；只在登录请求中传递，不进入存储。
   */
  password: string;
}

/**
 * 登录成功后的会话数据。
 */
export interface ILoginResult {
  /**
   * 后端签发的会话 token。
   */
  token: string;
  /**
   * 会话中的最小用户标识。
   */
  user: ISessionUser;
}

/**
 * 登出结果；服务端撤销成功后才允许丢弃本地会话。
 */
export interface ILogoutResult {
  /**
   * 服务端是否已撤销当前会话。
   */
  success: boolean;
}
