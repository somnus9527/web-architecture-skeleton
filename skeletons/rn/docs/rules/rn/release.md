# 发布与运行时配置规则

## 目的

本文件描述 React Native 项目的环境变量体系、EAS Build profile、env file 同步、Bundle 预算与发布门禁。

## 环境变量体系

### 双轨：本地 .env + eas.json

项目使用双轨配置：

| 配置位置                                                                   | 谁读           | 何时生效                                  |
| -------------------------------------------------------------------------- | -------------- | ----------------------------------------- |
| `env/.env.<environment>` + `scripts/dev-env.mjs` / `scripts/build-env.mjs` | 本机 node 进程 | **本地** `pnpm dev:xxx`、`pnpm build:xxx` |
| `eas.json:build.<profile>.env`                                             | EAS 云构建机器 | **云端** `eas build --profile <profile>`  |

两者必须**值保持一致**（同一环境的 `EXPO_PUBLIC_*` 字段值相同），通过架构测试自动校验。

### Public 变量前缀

只有 `EXPO_PUBLIC_*` 前缀的变量被 Expo CLI 注入客户端 bundle；其他前缀的变量只在 build 阶段可见，不会进入 App。

### 必填变量

```
EXPO_PUBLIC_APP_ENV         # development / staging / test / production / mock
EXPO_PUBLIC_API_BASE_URL    # 完整 API URL
EXPO_PUBLIC_IOS_APP_STORE_ID          # App Store numeric id，不含 id 前缀
EXPO_PUBLIC_ANDROID_APP_PACKAGE_NAME  # Google Play package name
```

### 可选变量

```
EXPO_PUBLIC_ANALYTICS_ENABLED   # 1 / true / yes / on 为 true，其他为 false
```

详见 `docs/rules/rn/api.md`。

### Env file 列表

```
env/
  .env.development     # 本地开发
  .env.staging         # staging
  .env.test            # 测试环境
  .env.production      # 生产
  .env.mock            # 本地 mock 服务
```

每个文件至少声明 `EXPO_PUBLIC_APP_ENV` + `EXPO_PUBLIC_API_BASE_URL`，按业务实际需要扩展其他 `EXPO_PUBLIC_*` 字段。

### 本地脚本

- `scripts/dev-env.mjs`：本地 dev 启动（拉起 Expo Metro + 可选 Prism mock）。
- `scripts/build-env.mjs`：本地 `expo export`（生成静态 bundle）。
- `scripts/env-utils.mjs`：env 读取、`__LAN_IP__` 替换、可注入到 Expo CLI 的 env 过滤。

两个入口都通过 `node --env-file=env/.env.<environment>` 注入变量，并设置 `EXPO_NO_DOTENV=1` 阻止 Expo CLI 自己再加载 dotenv。

### package.json scripts

```json
{
  "scripts": {
    "dev": "pnpm run dev:development",
    "dev:development": "node --env-file=env/.env.development scripts/dev-env.mjs",
    "dev:mock": "node --env-file=env/.env.mock scripts/dev-env.mjs --lan",
    "dev:staging": "node --env-file=env/.env.staging scripts/dev-env.mjs",
    "build:production": "node --env-file=env/.env.production scripts/build-env.mjs",
    ...
  }
}
```

### EAS Build profile

`eas.json` 必须为每个云构建 profile 显式声明 `env`：

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_APP_ENV": "development",
        "EXPO_PUBLIC_API_BASE_URL": "https://<dev-api-host>",
        "EXPO_PUBLIC_ANALYTICS_ENABLED": "false"
      }
    },
    "staging": {/* 同上结构 */},
    "production": {/* 同上结构 */}
  }
}
```

- `mock` / `test` 通常仅本地使用，不进 EAS profile（若需要远程构建跑 e2e，则补对应 profile）。

### 一致性架构测试

`src/test/architecture/eas-release-config.test.ts` 守护：

- 同一环境的 `env/.env.<env>` 与 `eas.json:build.<env>.env` 中 `EXPO_PUBLIC_*` 字段一致。
- `production` profile 的 `EXPO_PUBLIC_API_BASE_URL` 必须指向 production host。
- `mock` API base URL 不出现在 staging / production。

### 真 Secret 处理

- **`EXPO_PUBLIC_*` 视为公开值**：会打进 JS bundle，任何用户解包都能看到。仅放可公开的配置（API base URL、analytics flag 等）。
- **真 secret**（API key、签名 key、APM DSN 等）**禁止使用 `EXPO_PUBLIC_*` 前缀**。处理方式：
  - 走 EAS Secrets：`eas secret:create --name SECRET_NAME --value xxx`，在 `eas.json` 通过 `"$SECRET_NAME"` 引用。
  - 或走后端代理，不进入客户端。

## 发布门禁

发布前必须满足：

| 检查项                         | 工具                                               |
| ------------------------------ | -------------------------------------------------- |
| 类型检查通过                   | `pnpm typecheck`                                   |
| Lint 通过                      | `pnpm lint`                                        |
| 单测通过                       | `pnpm test`                                        |
| 架构测试通过                   | `pnpm test -- src/test/architecture/`              |
| EAS profile 与 env file 一致   | `src/test/architecture/eas-release-config.test.ts` |
| App 标识 / 版本 / build 号正确 | `src/test/architecture/expo-app-identity.test.ts`  |
| 关键资源齐全                   | `src/test/architecture/expo-app-assets.test.ts`    |
| 平台手测主链路通过             | 项目发布清单                                       |
| 生产 bundle hardening 未被关闭 | 项目发布清单                                       |

## App 标识与版本

### `app.json` 关键字段

```json
{
  "expo": {
    "name": "<App Display Name>",
    "slug": "<app-slug>",
    "version": "1.0.0",
    "scheme": "<app-scheme>",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "ios": {
      "bundleIdentifier": "com.<org>.<app>",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.<org>.<app>",
      "versionCode": 1
    }
  }
}
```

### 版本号管理

- `version` 跟随业务发版（Semantic Versioning）。
- iOS `buildNumber` / Android `versionCode` 每次提交商店递增。
- `eas.json` 中开 `autoIncrement: true`（staging / production）自动递增。

## Bundle 预算

### JS bundle 大小

| 项                  | 上限（参考） |
| ------------------- | ------------ |
| iOS JS bundle       | ≤ 5 MB       |
| Android JS bundle   | ≤ 5 MB       |
| iOS .ipa            | ≤ 200 MB     |
| Android .apk / .aab | ≤ 150 MB     |

超出时需调查：

- 大型依赖（locale 包、图标库）是否可裁剪。
- 资源（图片、字体）是否可压缩。
- 未使用代码是否能 tree-shake。

### Asset 预算

- App icon：iOS 1024×1024，Android 512×512。
- Splash：按 Expo splash 配置生成多分辨率。
- 业务图片：≤ 200 KB / 张，超大图片走 CDN。
- 字体：每个字重 ≤ 100 KB，只引入实际使用的字重。

### 监控

- 首次发版后记录 bundle size 作为基线。
- 每次发版 PR 描述列出 bundle size diff。
- 增长 ≥ 10% 时需要在 PR 中解释。

## Production Bundle Hardening

生产 EAS build 默认保留 Expo / RN 的安全基线：

- Hermes 作为 JS engine。`app.json` 不显式配置 `expo.jsEngine` 时沿用 Expo 默认 Hermes；不得在生产 profile 中无审批切换引擎。
- JS / CSS 生产 minify 保持开启；不得用 `--no-minify` 生成 store-bound artifact。
- Native 平台 Hermes bytecode 保持开启；不得用 `--no-bytecode` 或等价配置生成 store-bound artifact。
- 不把 minify、bytecode 或额外混淆当作 secret 保护；真 secret 仍按本文件"真 Secret 处理"执行。

如因上游平台 bug 临时关闭 Hermes、bytecode 或 minify，发布记录必须包含：

- 触发原因与受影响平台。
- 临时配置差异。
- 风险接受人。
- 回滚条件与复审日期。

## 手测主链路

发布候选必须至少完成一次以下平台手测：

```
home → primary listing/detail → primary action → external handoff（如有）→ result / confirmation
```

记录：

- 平台（iOS / Android）
- 模拟器或设备型号 + OS 版本
- API 环境（staging / production）
- App version + build number
- 订单号
- external return URL 形态
- 最终 result 状态

写入对应 release 的 execution record。

## OTA

详见 `docs/rules/rn/security.md` "OTA 决策" 小节。

**默认基线**：不启用 OTA，每次发版必须新 binary。

## 完成检查

- env file 与 eas.json 中 `EXPO_PUBLIC_*` 字段值一致（架构测试守护）。
- 真 secret 不使用 `EXPO_PUBLIC_*` 前缀，走 EAS Secrets 或后端代理。
- `app.json` version / buildNumber / versionCode 与发版一致。
- `pnpm typecheck` / `pnpm lint` / `pnpm test` 全部通过。
- 手测主链路证据写入 release record。
- bundle size 与 asset 预算未超出，超出时给出原因。
- 生产构建未关闭 Hermes、Hermes bytecode 或 JS minify，除非 release record 已记录审批例外。
