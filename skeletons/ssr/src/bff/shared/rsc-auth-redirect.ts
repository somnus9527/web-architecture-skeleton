import 'server-only';

import { redirect } from 'next/navigation';

import { BffAuthError } from '@/bff/transform/session-auth-transform';

/**
 * RSC 首屏读取遇到 BFF 鉴权失败时统一跳转登录页。
 */
export async function redirectToLoginOnBffAuthError<T>(task: Promise<T>): Promise<T> {
  try {
    return await task;
  } catch (error) {
    rethrowIfBffAuthError(error);
    throw error;
  }
}

/**
 * allSettled / 自定义降级流程中优先识别登录失效，避免被普通 fallback 吞掉。
 */
export function rethrowIfBffAuthError(error: unknown): void {
  if (error instanceof BffAuthError) {
    const notice = encodeURIComponent(error.codeMsg);
    redirect(`/login?notice=${notice}`);
  }
}
