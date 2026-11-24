# Native 动作规则

## 目的

本文件描述 React Native 项目中剪贴板、外部链接、浏览器、系统分享等 native 动作的统一入口、失败反馈与 URL 校验规则。

## 统一入口

所有 native 动作必须通过 `@components/native-actions` 暴露的 helper 调用；业务代码不直接 import `expo-clipboard`、`expo-web-browser`、`Linking`、`Share`。

完整 helper 实现见 `docs/rules/rn/templates/native-action-helper.md`。URL 校验逻辑见 `docs/rules/rn/templates/safe-url.md`。

## 标准 helper

### 剪贴板

```ts
import { copyTextWithFailureToast } from '@components/native-actions';

const success = await copyTextWithFailureToast(activationCode, {
  title: t('toast.copyFailed'),
  pushToast,
});

if (success) {
  pushToast({ title: t('toast.copySuccess'), variant: 'info' });
}
```

### 外部浏览器

```ts
import { openBrowserWithFailureToast } from '@components/native-actions';

await openBrowserWithFailureToast(item.externalGuideUrl, {
  title: t('toast.openBrowserFailed'),
  pushToast,
});
```

### 系统外链（mailto / tel / app scheme）

```ts
import { openUrlWithFailureToast } from '@components/native-actions';

await openUrlWithFailureToast(`mailto:${supportEmail}`, {
  title: t('toast.openMailFailed'),
  pushToast,
});
```

### 系统分享

```ts
import { shareWithFailureToast } from '@components/native-actions';

await shareWithFailureToast({ message: shareMessage, url: shareUrl }, { title: t('toast.shareFailed'), pushToast });
```

## URL 校验

### 进入 helper 前必须校验

`openBrowserWithFailureToast` 与 `openUrlWithFailureToast` 接受的 URL 必须经过 `@domain/safe-url` 校验：

- 协议在白名单：`https:`、`mailto:`、`tel:`、`<app-scheme>:`。
- HTTPS URL 的 host 在项目白名单。
- 校验失败立即 push toast + `logger.warn`，不打开 URL。

详见 `docs/rules/rn/security.md`。

### URL 来源分类

| 来源           | 是否需要校验         | 例子                         |
| -------------- | -------------------- | ---------------------------- |
| 编译期常量     | 否（已审过）         | 客服邮箱、Apple Support URL  |
| 静态 config 表 | 是（防 config 污染） | guides 内 cta、legal pages   |
| 用户输入       | 是                   | 添加联系方式时输入的网址     |
| API 响应       | 是                   | 条目详情中包含的外部指南链接 |

## 失败反馈

### 必须显式

所有 native 动作失败必须 push toast，**不允许静默吞掉**：

```ts
// 禁止
try {
  await Clipboard.setStringAsync(value);
} catch {
  // 静默
}

// 推荐：失败必有 toast
const success = await copyTextWithFailureToast(value, {
  title: t('toast.copyFailed'),
  pushToast,
});
```

由 `src/test/architecture/native-action-failure-feedback.test.ts` 守护。

### Toast 标题必须 i18n

失败 toast 标题由调用侧传入本地化文案，不允许 helper 内部硬编码：

```ts
// 推荐
title: t('feature.copy.failed'),

// 禁止
title: 'Copy failed',
```

### 成功反馈

写入剪贴板等"用户感知不强"的动作，成功后**必须** push 成功 toast，避免用户误以为没生效：

```ts
const success = await copyTextWithFailureToast(valueToCopy, { ... });

if (success) {
  pushToast({ title: t('feature.copy.success'), variant: 'info' });
}
```

## Toast Dispatcher

通过 `useAppToast()` 获取派发函数：

```tsx
import { useAppToast } from '@domain/toast/toast-provider';

function CopyButton() {
  const pushToast = useAppToast();
  const { t } = useTranslation();

  async function handleCopy() {
    await copyTextWithFailureToast(value, {
      title: t('toast.copyFailed'),
      pushToast,
    });
  }
}
```

## 平台差异

- iOS：`expo-web-browser` 默认使用 SFSafariViewController（应用内浏览器）。
- Android：默认 Custom Tabs。
- `mailto:` / `tel:` 失败说明系统未配置邮件 / 拨号应用；toast 文案应提示用户手动联系。
- iOS 14+ 复制剪贴板会显示系统提示气泡；这是平台行为，不需要绕过。

## 安全注意

- 不在剪贴板写入凭据 / token / 敏感字段。
- 不通过 `Linking.openURL` 打开未校验的 `https` URL（防止钓鱼）。
- 不通过 `Share` 透露用户隐私（订单号 / 邮箱默认不出现在 share 内容中）。

## 完成检查

- 业务代码不 import `expo-clipboard` / `expo-web-browser` / `Linking` / `Share`。
- URL 走 `@domain/safe-url` 校验后再传给 helper。
- 失败必 push toast；toast 标题 i18n。
- 写剪贴板等动作有成功 toast 反馈。
- 不在剪贴板 / 分享内容中泄漏敏感字段。
