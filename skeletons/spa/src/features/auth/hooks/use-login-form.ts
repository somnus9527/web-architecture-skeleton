import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { login } from '@/features/auth/services/auth-service';
import { t } from '@/locale';
import { ROUTE_PATHS } from '@/router/route-paths';
import { logger } from '@/shared/services/logger';
import { useSessionStore } from '@/shared/store/session-store';

import type { FormEvent } from 'react';

/**
 * 登录表单状态与事件。
 */
export interface IUseLoginFormResult {
  /**
   * 当前输入的账号。
   */
  username: string;
  /**
   * 当前输入的密码。
   */
  password: string;
  /**
   * 是否正在提交登录请求。
   */
  isSubmitting: boolean;
  /**
   * 用户可见的校验或登录失败说明。
   */
  errorMessage: string | null;
  /**
   * 更新账号输入。
   */
  updateUsername: (value: string) => void;
  /**
   * 更新密码输入。
   */
  updatePassword: (value: string) => void;
  /**
   * 提交登录表单。
   */
  submit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * 只接受站内相对路径作为登录后的跳转目标，拒绝协议相对地址和外部地址。
 *
 * @param value - 路由 query 中的 redirect 值。
 * @returns 规范化后的站内跳转路径。
 */
function readRedirectTarget(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return ROUTE_PATHS.workspace;
  }

  return value;
}

/**
 * 维护登录表单输入、提交状态和登录成功后的会话写入。
 *
 * @returns 登录页面需要的状态与事件。
 */
export function useLoginForm(): IUseLoginFormResult {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startSession = useSessionStore((state) => state.startSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * 调用登录接口并在成功后写入会话，然后回到被拦截的站内路径。
   */
  async function submitLogin(): Promise<void> {
    setErrorMessage(null);

    try {
      const result = await login({ username: username.trim(), password });

      startSession({ token: result.token, user: result.user });
      navigate(readRedirectTarget(searchParams.get('redirect')), { replace: true });
    } catch (error) {
      logger.error('auth_login_failed', { error });
      setErrorMessage(t('auth.login.failed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    username,
    password,
    isSubmitting,
    errorMessage,
    updateUsername: (value: string) => {
      setUsername(value);
    },
    updatePassword: (value: string) => {
      setPassword(value);
    },
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!username.trim() || !password) {
        setErrorMessage(t('auth.validation.required'));
        return;
      }

      setIsSubmitting(true);
      void submitLogin();
    },
  };
}
