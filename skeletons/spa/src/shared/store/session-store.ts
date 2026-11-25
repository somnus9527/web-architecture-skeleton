import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 会话持久化键；初始化骨架时由 initialize-spa-project 替换为项目前缀。
 */
export const SESSION_STORAGE_KEY = 'spa-app:session.v1';

/**
 * 持久化结构版本；版本不一致时按发版迁移处理，直接丢弃旧会话。
 */
export const SESSION_PERSIST_VERSION = 1;

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
 * 需要跨刷新保留的会话字段。
 */
interface IPersistedSession {
  /**
   * 会话 token；未登录时为 null。
   */
  token: string | null;
  /**
   * 最小用户标识；未登录时为 null。
   */
  user: ISessionUser | null;
}

/**
 * 会话 store 完整状态。
 */
interface ISessionState extends IPersistedSession {
  /**
   * 写入登录结果。
   */
  startSession: (session: { token: string; user: ISessionUser }) => void;
  /**
   * 清除内存会话态；持久化键由 persist 同步清理。
   */
  clearSession: () => void;
}

/**
 * 全局会话状态；默认持久化到 localStorage，登出、401/403 和发版迁移都会清空。
 */
export const useSessionStore = create<ISessionState>()(
  persist<ISessionState, [], [], IPersistedSession>(
    (set) => ({
      token: null,
      user: null,
      startSession: ({ token, user }) => {
        set({ token, user });
      },
      clearSession: () => {
        set({ token: null, user: null });
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: SESSION_PERSIST_VERSION,
      storage: createJSONStorage<IPersistedSession>(() => localStorage),
      /* 只持久化 token 与最小用户标识，不落权限全集、响应缓存或错误态。 */
      partialize: (state) => ({ token: state.token, user: state.user }),
      /* 结构版本变化即视为发版迁移，旧会话不允许继续使用。 */
      migrate: () => ({ token: null, user: null }),
    },
  ),
);

/**
 * 读取当前会话 token，供非 React 模块（API client）注入请求头。
 *
 * @returns 当前 token，未登录时为 null。
 */
export function getSessionToken(): string | null {
  return useSessionStore.getState().token;
}

/**
 * 清除会话，供非 React 模块在鉴权失败时调用。
 *
 * @returns void。
 */
export function clearSession(): void {
  useSessionStore.getState().clearSession();
}
