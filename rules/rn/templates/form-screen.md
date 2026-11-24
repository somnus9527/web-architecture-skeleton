# 表单 Screen 模版

> 上级规则：`docs/rules/rn/forms-keyboard.md`、`docs/rules/rn/accessibility.md`、`docs/rules/rn/error-handling.md`、`docs/rules/rn/frontend.md`。

## 适用场景

含输入 / 验证 / 提交流程的 screen，如登录、注册、找回密码、个人信息编辑、联系客服。

## 文件结构

按 `docs/rules/rn/frontend.md` 的拆分规则，复杂表单 screen 拆为：

```
src/components/auth/
  register-screen.tsx              # 主编排
  register-screen.types.ts         # 共享类型
  register-screen.config.ts        # 字段配置（returnKeyType、textContentType 等）
  register-screen.tools.ts         # 验证、归一化 helper
  use-register-form.ts             # 表单状态 + 提交流程 hook
  register-form-section.tsx       # 表单区块组件
```

## 完整模版

### types.ts

```ts
// src/components/auth/register-screen.types.ts

/**
 * 注册表单字段。
 */
export interface IRegisterFormFields {
  email: string;
  password: string;
  passwordConfirm: string;
  agreeTerms: boolean;
}

/**
 * 字段级错误。值为 i18n key。
 */
export type RegisterFormErrors = Partial<Record<keyof IRegisterFormFields, string>>;

/**
 * 提交服务签名；测试可注入 fake 实现。
 */
export type RegisterSubmitService = (input: IRegisterFormFields) => Promise<{ userId: string }>;
```

### config.ts

```ts
// src/components/auth/register-screen.config.ts
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';

export interface IFieldConfig {
  key: 'email' | 'password' | 'passwordConfirm';
  keyboardType: KeyboardTypeOptions;
  textContentType: TextInputProps['textContentType'];
  autoComplete: TextInputProps['autoComplete'];
  autoCapitalize: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  returnKeyType: TextInputProps['returnKeyType'];
}

/**
 * 字段顺序与键盘 / autofill 配置。
 */
export const REGISTER_FIELDS: readonly IFieldConfig[] = [
  {
    key: 'email',
    keyboardType: 'email-address',
    textContentType: 'emailAddress',
    autoComplete: 'email',
    autoCapitalize: 'none',
    returnKeyType: 'next',
  },
  {
    key: 'password',
    keyboardType: 'default',
    textContentType: 'newPassword',
    autoComplete: 'password-new',
    autoCapitalize: 'none',
    secureTextEntry: true,
    returnKeyType: 'next',
  },
  {
    key: 'passwordConfirm',
    keyboardType: 'default',
    textContentType: 'newPassword',
    autoComplete: 'password-new',
    autoCapitalize: 'none',
    secureTextEntry: true,
    returnKeyType: 'done',
  },
];
```

### tools.ts

```ts
// src/components/auth/register-screen.tools.ts
import type { IRegisterFormFields, RegisterFormErrors } from './register-screen.types';

/**
 * 邮箱基础校验。
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * 密码强度校验：≥ 8 位，含字母 + 数字。
 */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/**
 * 校验整张表单，返回字段级错误（值为 i18n key）。
 */
export function validateRegisterForm(fields: IRegisterFormFields): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  if (!fields.email) errors.email = 'auth.register.error.emailRequired';
  else if (!isValidEmail(fields.email)) errors.email = 'auth.register.error.emailInvalid';

  if (!fields.password) errors.password = 'auth.register.error.passwordRequired';
  else if (!isStrongPassword(fields.password)) errors.password = 'auth.register.error.passwordWeak';

  if (fields.password !== fields.passwordConfirm) {
    errors.passwordConfirm = 'auth.register.error.passwordMismatch';
  }

  if (!fields.agreeTerms) errors.agreeTerms = 'auth.register.error.termsRequired';

  return errors;
}
```

### use-register-form.ts

```ts
// src/components/auth/use-register-form.ts
import { useCallback, useState } from 'react';
import { ApiError } from '@api/errors';
import { logger } from '@api/logger';

import { validateRegisterForm } from './register-screen.tools';
import type { IRegisterFormFields, RegisterFormErrors, RegisterSubmitService } from './register-screen.types';

interface IUseRegisterFormParams {
  submit: RegisterSubmitService;
  onSuccess: (userId: string) => void;
  onFormError: (firstErrorField: keyof IRegisterFormFields) => void;
  onSubmitError: (errorMessage: string) => void;
}

export interface IRegisterFormController {
  fields: IRegisterFormFields;
  setField: <K extends keyof IRegisterFormFields>(key: K, value: IRegisterFormFields[K]) => void;
  errors: RegisterFormErrors;
  submitting: boolean;
  submit: () => Promise<void>;
}

const INITIAL_FIELDS: IRegisterFormFields = {
  email: '',
  password: '',
  passwordConfirm: '',
  agreeTerms: false,
};

/**
 * 注册表单状态与提交流程。
 */
export function useRegisterForm(params: IUseRegisterFormParams): IRegisterFormController {
  const { submit, onSuccess, onFormError, onSubmitError } = params;
  const [fields, setFields] = useState<IRegisterFormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback<IRegisterFormController['setField']>((key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    // 用户开始改字段时清除该字段错误
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const validation = validateRegisterForm(fields);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      const first = Object.keys(validation)[0] as keyof IRegisterFormFields;
      onFormError(first);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submit(fields);
      onSuccess(result.userId);
    } catch (error) {
      logger.warn('register_submit_failed', { error });
      const message = error instanceof ApiError ? error.message : 'auth.register.error.generic';
      onSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [fields, submit, onSuccess, onFormError, onSubmitError]);

  return { fields, setField, errors, submitting, submit: handleSubmit };
}
```

### register-screen.tsx（主编排）

```tsx
// src/components/auth/register-screen.tsx
import { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollView as ScrollViewType,
  type TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useAppToast } from '@domain/toast/toast-provider';
import { useThemeTokens } from '@theme/theme-provider';

import { REGISTER_FIELDS } from './register-screen.config';
import { useRegisterForm } from './use-register-form';
import type { IRegisterFormFields, RegisterSubmitService } from './register-screen.types';

interface IRegisterScreenProps {
  /**
   * 提交服务；默认通过 endpoint wrapper，测试时可注入 fake。
   */
  submit: RegisterSubmitService;
}

export function RegisterScreen({ submit }: IRegisterScreenProps) {
  const tokens = useThemeTokens();
  const { t } = useTranslation();
  const pushToast = useAppToast();

  const scrollRef = useRef<ScrollViewType>(null);
  const inputRefs = useRef<Partial<Record<keyof IRegisterFormFields, TextInput | null>>>({});

  const controller = useRegisterForm({
    submit,
    onSuccess: () => router.replace({ pathname: '/(tabs)' }),
    onFormError: (field) => {
      inputRefs.current[field]?.focus();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    onSubmitError: (messageKey) => {
      pushToast({ title: t(messageKey), variant: 'error' });
    },
  });

  // 字段提交时切焦点到下一个字段；最后一个字段触发提交
  function getOnSubmitEditing(currentKey: IRegisterFormFields[keyof IRegisterFormFields] | keyof IRegisterFormFields) {
    const index = REGISTER_FIELDS.findIndex((f) => f.key === currentKey);
    if (index < 0 || index === REGISTER_FIELDS.length - 1) {
      return () => void controller.submit();
    }
    const nextField = REGISTER_FIELDS[index + 1];
    return () => inputRefs.current[nextField.key]?.focus();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { gap: tokens.spacing.md, padding: tokens.spacing.lg }]}
      >
        {/* 表单字段区块 */}
        {REGISTER_FIELDS.map((field) => (
          <View key={field.key}>
            <Input
              ref={(node) => {
                inputRefs.current[field.key] = node;
              }}
              value={controller.fields[field.key] as string}
              onChangeText={(value) => controller.setField(field.key, value)}
              keyboardType={field.keyboardType}
              textContentType={field.textContentType}
              autoComplete={field.autoComplete}
              autoCapitalize={field.autoCapitalize}
              secureTextEntry={field.secureTextEntry}
              returnKeyType={field.returnKeyType}
              onSubmitEditing={getOnSubmitEditing(field.key)}
              accessibilityLabel={t(`auth.register.field.${field.key}.label`)}
              placeholder={t(`auth.register.field.${field.key}.placeholder`)}
              testID={`register-field-${field.key}`}
            />
            {/* 字段级错误：live region 让 a11y 实时播报 */}
            {controller.errors[field.key] && (
              <View accessibilityLiveRegion="polite" accessibilityRole="alert">
                <Text
                  style={{ color: tokens.colors.statusDanger, fontSize: tokens.typography.caption }}
                  testID={`register-error-${field.key}`}
                >
                  {t(controller.errors[field.key]!)}
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* 提交按钮：暴露 loading + disabled */}
        <Button
          label={t('auth.register.submit')}
          loading={controller.submitting}
          disabled={!controller.fields.email || !controller.fields.password}
          onPress={controller.submit}
          testID="register-submit"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
```

## 注意点

- **拆分**：types / config / tools / hook / 主 screen 五个文件，主文件 ≤ 350 行。
- **`KeyboardAvoidingView` + 平台分支**：iOS `padding`，Android `undefined`。
- **`keyboardShouldPersistTaps="handled"`**：避免键盘弹出时按钮第一次点击只关闭键盘。
- **字段 ref + onSubmitEditing**：切焦点到下一个字段，最后一个字段触发提交。
- **autofill / `textContentType` / `autoComplete`**：必须配齐，特别是 email / password / OTP。
- **字段级错误使用 live region**：`accessibilityLiveRegion="polite"` + `role="alert"`。
- **提交失败滚动到错误字段**：`scrollTo` + `inputRefs.current[field]?.focus()`。
- **submit 按钮 loading + disabled**：异步动作必须暴露状态；防重复提交。
- **错误文案 i18n key**：tools 中返回 i18n key，UI 中 `t(key)`。
- **不依赖大型表单库**：保持简单；如表单极度复杂再评估引入。

## 测试

```tsx
// src/test/components/auth/register-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from '@components/auth/register-screen';
import { TestProviders } from '@test/utils/test-providers';

describe('RegisterScreen', () => {
  it('shows email error when email invalid', () => {
    const submit = jest.fn();
    render(
      <TestProviders>
        <RegisterScreen submit={submit} />
      </TestProviders>,
    );

    fireEvent.changeText(screen.getByTestId('register-field-email'), 'not-an-email');
    fireEvent.changeText(screen.getByTestId('register-field-password'), 'Password123');
    fireEvent.changeText(screen.getByTestId('register-field-passwordConfirm'), 'Password123');
    fireEvent.press(screen.getByTestId('register-submit'));

    expect(screen.getByTestId('register-error-email')).toBeOnTheScreen();
    expect(submit).not.toHaveBeenCalled();
  });

  it('calls submit when fields valid', async () => {
    const submit = jest.fn().mockResolvedValue({ userId: 'u-1' });
    render(
      <TestProviders>
        <RegisterScreen submit={submit} />
      </TestProviders>,
    );

    fireEvent.changeText(screen.getByTestId('register-field-email'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('register-field-password'), 'Password123');
    fireEvent.changeText(screen.getByTestId('register-field-passwordConfirm'), 'Password123');
    // agreeTerms checkbox 视实际 UI 触发
    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(submit).toHaveBeenCalled();
    });
  });

  it('disables submit while submitting', async () => {
    let resolveSubmit: (v: { userId: string }) => void = () => {};
    const submit = jest.fn(
      () =>
        new Promise<{ userId: string }>((r) => {
          resolveSubmit = r;
        }),
    );

    render(
      <TestProviders>
        <RegisterScreen submit={submit} />
      </TestProviders>,
    );
    // ... fill fields, press submit, assert button is busy
    resolveSubmit({ userId: 'u-1' });
  });
});
```
