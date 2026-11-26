import { useLoginForm } from '@/features/auth/hooks/use-login-form';
import { t } from '@/locale';
import { Button, Input, LockOutlined } from '@/shared/ui';

/**
 * 登录页面，承载账号密码表单与登录失败反馈。
 *
 * @returns 登录页面节点。
 */
export function Component() {
  const form = useLoginForm();

  return (
    <main className="page-center">
      <section className="auth-card">
        <p className="auth-card__icon">
          <LockOutlined aria-hidden="true" />
        </p>
        <h1 className="auth-card__title">{t('auth.login.title')}</h1>
        <p className="auth-card__subtitle">{t('auth.login.subtitle')}</p>

        {/* 登录表单只负责收集凭证，会话写入与跳转由 hook 统一处理。 */}
        <form className="auth-form" onSubmit={form.submit}>
          <label className="auth-field">
            <span>{t('auth.login.username')}</span>
            <Input
              name="username"
              autoComplete="username"
              size="large"
              value={form.username}
              onChange={(event) => form.updateUsername(event.target.value)}
            />
          </label>

          <label className="auth-field">
            <span>{t('auth.login.password')}</span>
            <Input.Password
              name="password"
              autoComplete="current-password"
              size="large"
              value={form.password}
              onChange={(event) => form.updatePassword(event.target.value)}
            />
          </label>

          {form.errorMessage ? (
            /* 失败态保留表单内容，只追加可读错误说明。 */
            <p className="auth-error" role="alert" data-testid="login-error">
              {form.errorMessage}
            </p>
          ) : null}

          <Button htmlType="submit" isPending={form.isSubmitting} pendingLabel={t('auth.login.submitting')}>
            {t('auth.login.submit')}
          </Button>
        </form>

        {/* mock 阶段没有真实账号体系，明确提示可用任意非空凭证登录。 */}
        <p className="auth-hint">{t('auth.login.mock_hint')}</p>
      </section>
    </main>
  );
}
