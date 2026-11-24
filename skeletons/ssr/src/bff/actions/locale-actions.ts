'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { LOCALE_COOKIE_NAME, isLocaleCode } from '@/i18n/locale-config';

/**
 * 语言切换 Server Action 结果。
 */
export interface ISetLocaleResult {
  ok: boolean;
}

/**
 * 写入语言偏好 cookie 并刷新，供客户端语言切换（cookie + `router.refresh()` 模式，不改路由）。
 *
 * @param locale - 目标 locale，必须是受支持的 locale。
 * @returns 稳定操作结果。
 */
export async function setLocaleAction(locale: string): Promise<ISetLocaleResult> {
  if (!isLocaleCode(locale)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/');
  return { ok: true };
}
