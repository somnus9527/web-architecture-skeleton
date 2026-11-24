# 安全规则

## 目的

本文件描述 React Native 项目的 URL 校验、deep link 安全、敏感字段处理、传输安全、OTA 决策。

## URL 校验

### 入口集中

`@domain/safe-url` 是所有外部 URL 与 deep link 的统一校验入口。完整模版见 `docs/rules/rn/templates/safe-url.md`，核心思路：

```ts
// src/domain/safe-url.ts
const ALLOWED_PROTOCOLS = new Set(['https:', 'mailto:', 'tel:', '<app-scheme>:']);
const ALLOWED_HOSTS = new Set([/* 项目白名单 host */]);

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    if (parsed.protocol === 'https:' && !ALLOWED_HOSTS.has(parsed.host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function assertAllowedUrl(url: string): void {
  if (!isAllowedUrl(url)) {
    throw new Error(`URL not allowed: ${url}`);
  }
}
```

- `<app-scheme>` 由项目 `app.json:expo.scheme` 决定，配置在独立 `src/domain/safe-url-config.ts`，不硬编码到规则代码。
- Host 白名单同样维护在 config 文件，便于业务方独立修改。

### 强制使用位置

- `@components/native-actions` 中的 `openBrowserWithFailureToast` / `openUrlWithFailureToast` 调用前。
- Deep link 入口接收的 URL。
- 静态 config 表中的 `href` / `route` / `cta.url`。
- API 响应中的外部链接。
- 推送通知 payload 中的 `link` 字段。
- WebView `source.uri` 与 `onShouldStartLoadWithRequest` 拦截。

完整 helper 与配置注入模式见 `docs/rules/rn/templates/safe-url.md`。详见 `docs/rules/rn/native-actions.md`、`docs/rules/rn/webview.md`、`docs/rules/rn/push-notifications.md`。

## Deep Link 安全

### Scheme 配置

`app.json` 配置：

```json
{
  "expo": {
    "scheme": "<app-namespace>",
    "ios": {
      "bundleIdentifier": "com.example.<app-namespace>",
      "associatedDomains": ["applinks:<your-domain>"]
    },
    "android": {
      "package": "com.example.<app-namespace>",
      "intentFilters": [
        {
          "action": "VIEW",
          "category": ["BROWSABLE", "DEFAULT"],
          "data": [{ "scheme": "https", "host": "<your-domain>" }],
          "autoVerify": true
        }
      ]
    }
  }
}
```

### Deep link 入口校验

`src/components/navigation/deep-link-bridge.tsx`：

```tsx
useEffect(() => {
  function handleUrl(event: { url: string }) {
    if (!isAllowedUrl(event.url)) {
      logger.warn('deep_link_rejected', { url: event.url });
      return;
    }
    // 分发到 expo-router
    Linking.openURL(event.url);
  }

  const subscription = Linking.addEventListener('url', handleUrl);
  Linking.getInitialURL().then((url) => url && handleUrl({ url }));

  return () => subscription.remove();
}, []);
```

deep link 入口模版与推送 link 校验见 `docs/rules/rn/templates/safe-url.md`、`docs/rules/rn/push-notifications.md`。

### External Return Custom Scheme

- 外部系统回跳 URL（如 `<app-scheme>://external/return?requestId=...`）必须校验：
  - scheme 匹配。
  - query 必填字段存在。
  - `requestId` 等业务标识通过校验后才允许查询服务端状态。
- 不允许伪造的外部回跳直接进入成功页面；必须 backend 二次确认。

## 敏感字段处理

### 存储

详见 `docs/rules/rn/storage.md` 中的"敏感字段存储矩阵"。

要点：

- session token / 凭据类 → SecureStore。
- PII（邮箱、姓名） → AsyncStorage 但日志 redact。
- 真 secret（API key、签名 key）→ 不进入客户端 bundle 或 storage。

### 日志

详见 `docs/rules/rn/observability.md` 中的 redaction 规则。

### 传输

- 所有 API 必须使用 HTTPS。
- 不允许在 query string 传 token / password / 邮箱（容易进入服务端 access log）。
- 凭据走 Authorization header。

### 内存

- 凭据使用后立即清除：
  ```ts
  let password = userInput;
  await login(password);
  password = '';
  ```
- 在 React state 中存的密码字段，提交后调 `setPassword('')`。

## 剪贴板与分享

- 不在剪贴板写入凭据 / token / 完整邮箱。
- 写入 OTP / 激活码 / 邀请码后必须 push 成功 toast，避免用户误以为没生效。
- 分享内容必须经审查；不暴露用户隐私（订单号、邮箱默认不出现）。

## Cert Pinning

### 默认基线

默认不启用 cert pinning。原因：

- 后端使用 LetsEncrypt / 公开 CA，自动续期。
- 引入 pinning 后证书轮换需要新 binary，机动性差。
- 默认风险面主要由 HTTPS、URL 白名单、deep link 校验、凭据不进 query string 与 logger redaction 覆盖；pinning 暂不作为默认门禁。

### 触发评估

满足以下任一条件需评估引入：

- 监管 / 合规要求（金融、政府场景）。
- 渗透测试发现 MITM 风险。
- 后端切换到私有 CA。
- API gateway 切到固定证书链、专线或高风险支付域名，且证书轮换 runbook 已明确。
- 安全评审要求移动端对特定 host 增加传输层强绑定。

实现选项：

- `react-native-ssl-pinning` 包。
- iOS / Android native 配置。

如未来启用，必须先完成：

- 证书轮换 runbook 与备用 pin 设计，避免证书正常更新导致客户端整体断网。
- staging / production 分域策略，避免测试证书误带入生产。
- 失败 UX 与 observability 事件，区分网络失败、pin mismatch 与后端证书过期。
- EAS build / native config 的回归验证，确保 iOS 与 Android 行为一致。

## Code Signing（OTA 相关）

详见本文件 "OTA 决策" 小节。如启用 OTA，必须启用代码签名。

## Bundle Hardening

- Expo / RN build 默认对 JS 做 minify + Hermes bytecode 编译。
- 不依赖混淆保护 secret；任何打进 bundle 的字符串都视为公开。
- 业务逻辑混淆收益不大；不引入额外混淆工具。
- production EAS build 不允许无审批关闭 Hermes bytecode 或 JS minify；如因平台 bug 临时关闭，必须在发布记录中写明影响、回滚条件和复审日期。
- `app.json` 不显式配置 `expo.jsEngine` 时使用 Expo 默认 Hermes；如未来显式覆盖，需要在 `docs/rules/rn/release.md` 和 release checklist 同步记录。
- Metro minifier 可按 Expo 文档替换，但不得配置为跳过生产 minify；替换前需评估 bundle size、source map、crash stack 可读性与 Hermes bytecode 兼容性。

## OTA 决策

### 默认基线

默认不启用 OTA（Over-The-Air JS bundle updates）。原因：

- 如果公司未提供 EAS Update 服务订阅，或未自建 OTA 服务器（`expo-updates` 自托管协议），不得启用 OTA。
- 没有可用服务的情况下不引入 `expo-updates` 依赖。

每次 JS 与 native 改动都必须新 binary（重新打包 + 商店审核 + 用户下载）。

为了在不接 OTA 的前提下让用户尽早装新版本，**必须接入应用版本更新提示**：版本检查 + 强制 / 建议更新 modal + 跳转商店。详见 `docs/rules/rn/app-version-update.md` 与 `docs/rules/rn/templates/app-version-gate.md`。

### 触发评估

满足以下任一条件需重新评估：

- 公司采购 EAS Update 或类似 OTA 服务。
- 业务方需要"绕过商店审核紧急修 JS 层 bug"的能力，且能承担相应运营成本。
- 用户基数达到 X 万，App Store 审核节奏成为业务瓶颈。

### 评估时需要决策的内容

如未来启用，至少要覆盖以下工作面：

1. 依赖（`expo-updates`）与基础配置（`app.json:updates.url` / `runtimeVersion.policy`）。
2. Runtime version 策略（`appVersion` / `sdkVersion` / `fingerprint`）。
3. Channel 命名与发布权限矩阵。
4. EAS Update 服务接入（或自建 server）。
5. 更新检测时机与用户感知 UX（`ON_LOAD` / silent / user-prompted）。
6. 错误处理与降级路径（4 种失败：网络、损坏、版本不匹配、启动失败）。
7. 代码签名（`expo-updates` ed25519 签名）。
8. 灰度与回滚 runbook。
9. Native 变更门禁（CI 防误推）。
10. 可观测性接入（下载 / 应用 / 失败率指标）。
11. 商店合规审查（Apple Guideline 4.7）。
12. 文档（开发者 / 发布负责人 / on-call runbook）。

## App Permission

### 最小权限原则

`app.json` 中只声明实际使用的权限：

```json
{
  "ios": {
    "infoPlist": {
      "NSPhotoLibraryUsageDescription": "用于上传头像照片"
    }
  },
  "android": {
    "permissions": ["INTERNET"]
  }
}
```

- 不预申请权限"以备未来"。
- 权限用途说明必须 i18n（用户可见）。

## 第三方依赖安全

详见 `docs/rules/rn/dependencies.md`。

要点：

- native 包优先级：`expo-*` > 社区 RN 包（含 config plugin）> 需要 prebuild 的包。
- 引入新依赖前评估安全（许可证、维护状态、CVE 历史）。
- `pnpm-lock.yaml` 变更 PR 必须 review。
- 不引入未审核的包。

## 完成检查

- URL 通过 `@domain/safe-url` 校验后再传给 native action。
- Deep link 入口有白名单校验。
- 凭据不进 query string、不进剪贴板、不进 logger 输出。
- 真 secret 不打入客户端 bundle 与 storage。
- App permission 最小化、用途说明 i18n。
- OTA 决策：默认不启用；如项目启用，必须记录原因、触发条件、发布与回滚流程。
- Cert pinning 默认不启用；若触发评估条件满足，先补 runbook 与双平台验证。
- Production bundle hardening 保持 Hermes bytecode + JS minify，不把混淆当作 secret 保护手段。
