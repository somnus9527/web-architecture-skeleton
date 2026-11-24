# 存储规则

## 目的

本文件描述 React Native 项目的本地持久化边界、SecureStore 与 AsyncStorage 的使用规则、敏感字段存储矩阵。

## 边界

`src/storage/*` 是 `expo-secure-store` 与 `@react-native-async-storage/async-storage` 的**唯一直接边界**。

```
业务代码 (domain / components)
  ↓ 通过 storage wrapper API 调用
src/storage/*
  ↓ import @react-native-async-storage / expo-secure-store
平台 storage
```

- 业务代码、UI 代码、API 代码**禁止**直接 import `@react-native-async-storage/async-storage` 或 `expo-secure-store`。
- 由 `src/test/architecture/layer-boundary.test.ts` 守护。
- 测试代码可以直接 import（用于 mock）。

## 存储类型选择

### SecureStore（敏感字段）

- 走 iOS Keychain / Android EncryptedSharedPreferences。
- 容量小（每条 ≤ 2 KB，复杂结构需要拆分）。
- 适合：session token、refresh token、二步验证临时码。

### AsyncStorage（非敏感持久数据）

- 走平台普通存储；性能好，容量大。
- 适合：locale 偏好、theme 偏好、业务草稿、最近搜索、隐私偏好。
- 写入前序列化（JSON.stringify），读取后反序列化。

### 内存 only（不持久化）

- 走 React Context / Zustand state，App 关闭即丢失。
- 适合：query cache、modal 临时状态、表单中间态。

## 敏感字段存储矩阵

| 字段类别      | 示例                                          | 存储位置         | 加密         | TTL                  |
| ------------- | --------------------------------------------- | ---------------- | ------------ | -------------------- |
| Session token | `accessToken`、`refreshToken`、二步验证临时码 | SecureStore      | 平台原生加密 | 跟随 token expiry    |
| 账户身份      | 用户 ID、邮箱、显示名                         | AsyncStorage     | 否           | 跟随 session         |
| 用户偏好      | locale、currency、theme                       | AsyncStorage     | 否           | 永久（用户主动清除） |
| 业务状态      | 草稿、最近搜索、阅读进度                      | AsyncStorage     | 否           | 业务定义             |
| 隐私偏好      | analytics consent、cookie 等                  | AsyncStorage     | 否           | 永久 + 写入时间戳    |
| 一次性凭据    | 短信验证码、邮箱验证码                        | 不持久化（内存） | —            | 立即作废             |
| 凭据类 secret | API key、签名 key                             | 不进入客户端     | —            | —                    |

**关键规则**：

- 任何带"过期 / 凭据"语义的字段进 SecureStore，其他进 AsyncStorage。
- 邮箱、显示名等 PII 可以进 AsyncStorage，但日志中必须 redact（详见 `docs/rules/rn/observability.md`）。
- 真正的 API key / 签名 key **绝不** 进入客户端 bundle 或客户端 storage；走后端代理。

### 项目字段对齐

每个 App 必须在项目本地文档维护 storage 字段矩阵，禁止把某个 App 的 key 清单写入公司通用规则。建议使用以下列：

| Key                               | 写入入口                                                           | 字段                    | 矩阵分类            | 存储位置     | 处置                               |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------- | ------------------- | ------------ | ---------------------------------- |
| `<app-namespace>.session`         | `src/storage/<secure-session>.ts`                                  | session token           | Session token       | SecureStore  | 跟随 token expiry；日志必须 redact |
| `<app-namespace>.preferences`     | `src/storage/<preferences>.ts`                                     | locale、theme、隐私偏好 | 用户偏好 / 隐私偏好 | AsyncStorage | 用户主动重置时清理                 |
| `<app-namespace>.<feature>.draft` | `src/domain/<feature>/store.ts` 经 `src/storage/persisted-json.ts` | 业务草稿                | 业务状态            | AsyncStorage | 不包含 token、验证码或支付凭据     |

`src/storage/persisted-json.ts` 是通用 JSON 序列化封装，不拥有独立业务字段；新增调用方写入新的 AsyncStorage key 时，必须先按矩阵补充分类与处置。

## Storage Wrapper API

### SecureStore wrapper

`src/storage/secure-session.ts`：

```ts
// 读
export async function readSecureSession(): Promise<ISecureSession | null> { ... }

// 写
export async function writeSecureSession(session: ISecureSession): Promise<void> { ... }

// 清除
export async function clearSecureSession(): Promise<void> { ... }
```

### AsyncStorage wrapper

`src/storage/persisted-json.ts`：

```ts
export type JsonStorage = {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
  clear(key: string): Promise<void>;
};

export async function readPersistedJson<T>(key: string, storage?: JsonStorage): Promise<T | null> { ... }
export async function writePersistedJson<T>(key: string, value: T, storage?: JsonStorage): Promise<void> { ... }
export async function clearPersistedJson(key: string, storage?: JsonStorage): Promise<void> { ... }
```

每个 wrapper 接受可选 `storage` 参数用于测试注入。

## Key 命名

- 全局唯一 key，使用 **`<app-namespace>.<area>[.<version>]`** 格式。`<app-namespace>` 是该项目的固定前缀（取自 `app.json:expo.slug` 或独立常量），所有 storage key 使用同一前缀。

  ```ts
  // src/storage/keys.ts
  const APP_NAMESPACE = '<app-namespace>'; // 由项目定义，对应 app.json:slug

  export const FEATURE_DRAFT_STORAGE_KEY = `${APP_NAMESPACE}.<feature>.draft`;
  export const LOCALE_STORAGE_KEY = `${APP_NAMESPACE}.locale`;
  export const PRIVACY_PREFERENCES_KEY = `${APP_NAMESPACE}.privacy.v1`;
  ```

- Key 为 `kebab.dot` 格式（小写、单词用 `-` 连接、层级用 `.`）；不允许特殊字符。
- 业务 schema 不兼容时升级版本号后缀（`.v1` → `.v2`）。

## 数据迁移

- 反序列化失败（JSON 损坏 / schema 不兼容）时：清除该 key + 写日志（`logger.warn`） + fallback 到默认值。不允许 throw 阻塞 App 启动。
- schema 升级时提供 migrator 函数；旧 key 读出后转换写到新 key。

```ts
async function migrateDraftV1ToV2(storage: JsonStorage): Promise<void> {
  const oldDraft = await storage.read<IFeatureDraftV1>(FEATURE_DRAFT_STORAGE_KEY);
  if (!oldDraft) return;
  const newDraft = transformDraftV1ToV2(oldDraft);
  await storage.write(`${FEATURE_DRAFT_STORAGE_KEY}.v2`, newDraft);
  await storage.clear(FEATURE_DRAFT_STORAGE_KEY);
}
```

## Hydration 时机

- Store hydration（从 storage 读初始值）在对应 Provider mount 时触发，而非应用启动时立即触发：
  ```ts
  // src/domain/<feature>/<feature>-provider.tsx
  useEffect(() => {
    void useFeatureStore.getState().hydrateDraft();
  }, []);
  ```
- 关键 store（locale、session）的 hydration 是 splash 隐藏的前置条件；详见 `docs/rules/rn/startup.md`。

## 容量与性能

- AsyncStorage：单 key 推荐 < 100 KB；超大数据（图片缓存、历史记录）使用 FlatList 分页 + LRU 策略而非全量持久化。
- SecureStore：单 key 严格 ≤ 2 KB；复杂数据拆分或外置加密后存 AsyncStorage。

## 测试

- 测试中通过 `jest.mock('@react-native-async-storage/async-storage', ...)` 与 `jest.mock('expo-secure-store', ...)` 注入 fake；不要依赖真实平台 storage。
- Storage wrapper 自身的测试在 `src/test/storage/*`。

## 完成检查

- 业务代码不 import `@react-native-async-storage/async-storage` 或 `expo-secure-store`。
- 字段按矩阵分类到正确的存储位置。
- key 使用统一前缀 + 版本号。
- 反序列化失败有 fallback，不 throw 阻塞 App。
- Store hydration 在 Provider mount 时触发，关键字段在 splash 隐藏前完成。
