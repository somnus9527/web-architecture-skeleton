# 键盘与表单规则

## 目的

本文件描述 React Native 项目的键盘适配、表单字段顺序、autofill、密码管理器交互、错误反馈与提交流程。

## 键盘适配

### KeyboardAvoidingView

含输入框的 screen 必须使用 `KeyboardAvoidingView` 防止键盘遮挡：

```tsx
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  // Android 通过 manifest android:windowSoftInputMode="adjustResize" 自动 resize
>
  <ScrollView keyboardShouldPersistTaps="handled">...</ScrollView>
</KeyboardAvoidingView>
```

- iOS：`behavior="padding"`，给底部留出键盘高度的 padding。
- Android：`behavior={undefined}`，依赖 `windowSoftInputMode="adjustResize"`（在 `app.json` 配置）。

### keyboardShouldPersistTaps

ScrollView 包含按钮时设 `keyboardShouldPersistTaps="handled"`，否则键盘弹出时按钮第一次点击仅关闭键盘：

```tsx
<ScrollView keyboardShouldPersistTaps="handled">
  <Input />
  <Button onPress={handleSubmit} />
</ScrollView>
```

### 键盘关闭

- 提交按钮按下时调 `Keyboard.dismiss()`。
- 切换 screen / modal 时键盘自动关闭（RN 默认）。
- 用户点击 ScrollView 空白区时关闭键盘（通过 `keyboardShouldPersistTaps="handled"` + ScrollView wrapper Pressable）。

## 字段顺序与切换

### returnKeyType

按字段在表单中的位置设置：

- 中间字段：`returnKeyType="next"`
- 最后字段：`returnKeyType="done"` 或 `"go"`（即提交）

```tsx
<Input
  ref={emailRef}
  returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()}
/>

<Input
  ref={passwordRef}
  secureTextEntry
  returnKeyType="done"
  onSubmitEditing={handleSubmit}
/>
```

### Focus 切换

每个 Input 暴露 `ref`，下一个字段通过 `ref.current?.focus()` 接管焦点。

### 数字键盘

- 邮箱字段：`keyboardType="email-address"` + `autoCapitalize="none"`
- 数字字段：`keyboardType="number-pad"` 或 `"decimal-pad"`
- 电话字段：`keyboardType="phone-pad"`
- 一次性验证码：`keyboardType="number-pad"` + `textContentType="oneTimeCode"`（iOS）+ `autoComplete="sms-otp"`（Android）

## Autofill 与密码管理器

### textContentType（iOS）+ autoComplete（Android）

```tsx
// 邮箱
<Input
  textContentType="emailAddress"
  autoComplete="email"
  keyboardType="email-address"
  autoCapitalize="none"
/>

// 密码（登录）
<Input
  secureTextEntry
  textContentType="password"
  autoComplete="password"
/>

// 密码（注册 / 修改）
<Input
  secureTextEntry
  textContentType="newPassword"
  autoComplete="password-new"
/>

// 一次性验证码
<Input
  keyboardType="number-pad"
  textContentType="oneTimeCode"
  autoComplete="sms-otp"
/>

// 姓名
<Input
  textContentType="givenName"
  autoComplete="given-name"
/>
```

### associatedDomains（iOS）

要求强密码 + 凭据保存到 iCloud Keychain 需要在 `app.json` 配 `associatedDomains: ["webcredentials:domain.com"]`。

## 验证与错误反馈

### 字段级错误

错误信息显示在字段下方，使用 `accessibilityLiveRegion="polite"`：

```tsx
<Input ref={emailRef} value={email} onChangeText={setEmail} accessibilityLabel={t('auth.email.label')} />;

{
  emailError && (
    <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: tokens.colors.statusDanger }]}>
      {emailError}
    </Text>
  );
}
```

### 表单级错误

提交失败的整体错误（如 "邮箱或密码错误"）使用 toast 或顶部 banner。

### 实时校验时机

- **不要在 onChangeText 中立即校验**（用户输入到一半显示"无效"是反感的）。
- **onBlur 时校验**：字段失焦后校验。
- **提交时校验**：提交前再校验一次所有字段。

### 提交按钮

- 字段不全或验证不通过时 `disabled={true}`。
- 提交中 `loading={true}`，按钮文案切换为 "提交中..."。
- 提交后无论成功失败，回到 `loading={false}`。

```tsx
<Button
  label={t('auth.login.submit')}
  loading={loginMutation.isPending}
  disabled={!email || !password}
  onPress={handleSubmit}
/>
```

## 滚动到错误字段

提交失败时滚动到第一个错误字段：

```ts
async function handleSubmit() {
  const errors = validateForm({ email, password });

  if (errors.email) {
    emailRef.current?.focus();
    scrollViewRef.current?.scrollTo({ y: emailFieldYOffset, animated: true });
    return;
  }

  // ...
}
```

- 长表单使用 `useRef<View>` 标记字段位置 + `measureLayout` 获取 Y 坐标。
- 短表单（≤ 4 字段）直接 focus 第一个错误字段即可。

## 防重复提交

- 提交按钮 `disabled={loading}`，避免双击触发两次。
- Mutation `retry: 0`，避免网络抖动重试触发重复创建。
- 提交后 navigate 到下一页或显示成功态，避免用户疑惑。

## 实现锚点

公司规则不引用某个 App 的实际表单文件。项目应在本地执行记录中维护参考实现锚点，至少覆盖：

- `KeyboardAvoidingView` 的 iOS / Android 平台分支。
- `ScrollView keyboardShouldPersistTaps="handled"`。
- 字段配置集中维护：`keyboardType`、`returnKeyType`、`textContentType`、`autoComplete`。
- `onSubmitEditing` 焦点切换、长表单 scroll-to-error 与字段级 live region。

不要把某个项目当前锚点未覆盖的能力视为已全量落地。

## 表单状态管理

- 简单表单（≤ 5 字段）使用 `useState` 逐字段管理。
- 复杂表单（注册、资料编辑、提交确认等）抽出 `use<Form>Form` hook，详见 `docs/rules/rn/templates/form-screen.md`：
  ```ts
  export function useRegisterForm(params: IUseRegisterFormParams): IRegisterFormController {
    const [fields, setFields] = useState<IRegisterFormFields>(INITIAL_FIELDS);
    const [errors, setErrors] = useState<RegisterFormErrors>({});
    // ...
  }
  ```
- 不引入大型表单库（如 `react-hook-form`、`formik`），保持简单。

## 隐私与敏感字段

- 密码字段 `secureTextEntry`。
- 邮箱 / 电话字段在日志中 redact（详见 `docs/rules/rn/observability.md`）。
- 不在 console.log 中打印表单完整 state。

## 完成检查

- 表单 screen 使用 `KeyboardAvoidingView` + 平台分支。
- ScrollView 设 `keyboardShouldPersistTaps="handled"`。
- 字段配 `returnKeyType` + `onSubmitEditing` 切换 focus。
- 邮箱 / 密码 / OTP 字段配 `textContentType` + `autoComplete`。
- 提交按钮处理 disabled + loading 双态。
- 字段级错误使用 live region。
- 提交失败滚动到第一个错误字段。
- 不在 console / 日志中打印密码、token 等敏感字段。
