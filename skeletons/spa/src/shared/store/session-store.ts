import { create } from 'zustand';

/**
 * 会话状态。
 *
 * - `unknown`：应用刚启动，尚未向服务端确认会话；
 * - `authenticated`：服务端已通过 HttpOnly cookie 确认登录；
 * - `anonymous`：未登录或会话已失效。
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * 会话中允许保留的最小用户标识；权限全集与敏感资料不得进入会话。
 */
export interface ISessionUser {
  /**
   * 后端返回的用户唯一标识。
   */
  id: string;
  /**
   * 顶栏展示用的用户名称。
   */
  displayName: string;
}

/**
 * 会话 store 完整状态。
 */
interface ISessionState {
  /**
   * 当前会话状态；只由服务端会话接口驱动。
   */
  status: SessionStatus;
  /**
   * 当前登录用户的最小展示信息；未登录时为 null。
   */
  user: ISessionUser | null;
  /**
   * 写入服务端已确认的登录用户。
   */
  startSession: (user: ISessionUser) => void;
  /**
   * 标记当前为匿名态；不写任何浏览器存储。
   */
  markAnonymous: () => void;
  /**
   * 清除内存会话态。
   */
  clearSession: () => void;
}

/**
 * 全局会话状态。
 *
 * 会话凭证只存在于服务端下发的 HttpOnly cookie 中；本 store 不持久化，也不保存 token。
 * 刷新后由 `require-session` 调用 `/auth/session` 重新水合。
 */
export const useSessionStore = create<ISessionState>()((set) => ({
  status: 'unknown',
  user: null,
  startSession: (user) => {
    set({ status: 'authenticated', user });
  },
  markAnonymous: () => {
    set({ status: 'anonymous', user: null });
  },
  clearSession: () => {
    set({ status: 'anonymous', user: null });
  },
}));

/**
 * 清除会话，供非 React 模块在鉴权失败时调用。
 *
 * @returns void。
 */
export function clearSession(): void {
  useSessionStore.getState().clearSession();
}
