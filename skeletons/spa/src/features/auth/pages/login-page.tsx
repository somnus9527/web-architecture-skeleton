import { LockKeyhole } from 'lucide-react';

import { useLoginForm } from '@/features/auth/hooks/use-login-form';
import { t } from '@/locale';

/**
 * 登录页面，承载账号密码表单与登录失败反馈。
 *
 * @returns 登录页面节点。
 */
export function Component() {
  const form = useLoginForm();

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4 py-8 text-slate-900">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="inline-flex size-10 items-center justify-center rounded-md bg-slate-900 text-white">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </p>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">{t('auth.login.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('auth.login.subtitle')}</p>

        {/* 登录表单只负责收集凭证，会话写入与跳转由 hook 统一处理。 */}
        <form className="mt-6 flex flex-col gap-4" onSubmit={form.submit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{t('auth.login.username')}</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={(event) => form.updateUsername(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{t('auth.login.password')}</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => form.updatePassword(event.target.value)}
            />
          </label>

          {form.errorMessage ? (
            /* 失败态保留表单内容，只追加可读错误说明。 */
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              data-testid="login-error"
            >
              {form.errorMessage}
            </p>
          ) : null}

          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="submit"
            disabled={form.isSubmitting}
          >
            {form.isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        {/* mock 阶段没有真实账号体系，明确提示可用任意非空凭证登录。 */}
        <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          {t('auth.login.mock_hint')}
        </p>
      </section>
    </main>
  );
}
