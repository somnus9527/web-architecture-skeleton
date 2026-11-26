'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { serverLogger } from '@/bff/shared/logger/server-logger';
import { createRequestContext } from '@/bff/shared/request-context';
import { getServerConfig } from '@/bff/shared/server-config';
import { BffAuthError, buildBackendAuthHeaders } from '@/bff/transform/session-auth-transform';

const refreshInputSchema = z.object({
  category: z.string().min(1).max(64),
});

/**
 * Server Action 稳定返回结构。永远返回可序列化 result，绝不把裸异常抛给 UI。
 */
export interface IShowcaseActionResult {
  ok: boolean;
  errorCode?: string;
}

/**
 * Server Action 正面样板：鉴权 → 校验 → （调 service）→ revalidate → 稳定 result。
 *
 * 演示要点：失败分支写结构化 error 日志并返回带 errorCode 的稳定 result，不静默吞错。
 *
 * @param formData - 表单数据，含 `category`。
 * @returns 可序列化的操作结果。
 */
export async function refreshShowcaseAction(formData: FormData): Promise<IShowcaseActionResult> {
  const locale = await getLocale();
  const requestHeaders = await headers();
  const context = createRequestContext(requestHeaders, locale);
  const config = getServerConfig();
  const startedAt = Date.now();

  serverLogger.info('server action started', {
    requestId: context.requestId,
    routeId: 'action:refresh-showcase',
    span: 'server_action',
    fields: { action: 'refreshShowcase', category: String(formData.get('category') ?? '').slice(0, 64) },
  });

  try {
    // 1) 鉴权：同源会话 cookie → 后端鉴权头。
    buildBackendAuthHeaders(requestHeaders, config.sessionCookieName);

    // 2) 入参校验。
    const parsed = refreshInputSchema.safeParse({ category: formData.get('category') });
    if (!parsed.success) {
      serverLogger.warn('server action rejected', {
        requestId: context.requestId,
        routeId: 'action:refresh-showcase',
        span: 'server_action',
        fields: { action: 'refreshShowcase', errorCode: 'invalid_input', durationMs: Date.now() - startedAt },
      });
      return { ok: false, errorCode: 'invalid_input' };
    }

    // 3) 调 mutation service（骨架仅演示链路，无真实写操作）。
    // 4) 按影响 revalidate。
    revalidatePath('/showcase-console');
    serverLogger.info('server action completed', {
      requestId: context.requestId,
      routeId: 'action:refresh-showcase',
      span: 'server_action',
      fields: { action: 'refreshShowcase', ok: true, durationMs: Date.now() - startedAt },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof BffAuthError) {
      serverLogger.warn('server action rejected', {
        requestId: context.requestId,
        routeId: 'action:refresh-showcase',
        span: 'server_action',
        fields: { action: 'refreshShowcase', errorCode: error.code, durationMs: Date.now() - startedAt },
      });
      return { ok: false, errorCode: error.code };
    }

    serverLogger.error('refreshShowcaseAction failed', {
      requestId: context.requestId,
      routeId: 'action:refresh-showcase',
      fields: { message: error instanceof Error ? error.message : String(error) },
    });
    return { ok: false, errorCode: 'internal_error' };
  }
}

/**
 * `<form action>` 适配包装：执行 action 并丢弃 result（RSC 表单场景无需读返回值）。
 * 需要读取 result 的场景，请在 Client Component 用 `useActionState` 调用 `refreshShowcaseAction`。
 *
 * @param formData - 表单数据。
 */
export async function refreshShowcaseFormAction(formData: FormData): Promise<void> {
  await refreshShowcaseAction(formData);
}
