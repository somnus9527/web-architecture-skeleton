# RN Application Skeleton

基于 Expo + expo-router 的 React Native 骨架。目录遵循 `docs/rules/rn/architecture.md` 的分层契约：

```text
app/                  expo-router 路由壳，只处理路由与壳层
src/api/              网络层：client / config / errors / logger + endpoints/
src/components/       UI 层：feature screen、ui primitive、providers
src/domain/           业务逻辑：contracts、i18n、network、safe-url、adapter、store（按需）
src/theme/            设计 token、Paper theme 映射、ThemeProvider
src/test/             单测、组件测试、架构测试、测试 Provider
env/                  环境模板（env/.env.<environment>.example）
docs/rules/rn/        规范与代码模板
docs/initialization/  初始化清单
scripts/              门禁、卫生、env 初始化脚本
```

`src/storage/` 尚未创建：当前没有 SecureStore / AsyncStorage 调用。接入持久化时按
`docs/rules/rn/storage.md` 新建该目录，并保持平台 storage 只能从这里 import。

## 初始化

复制骨架后先跑项目身份初始化，再开始业务开发：

```bash
node .agents/skills/initialize-rn-project/scripts/initialize-rn-project.mjs --dry-run <project-id>
node .agents/skills/initialize-rn-project/scripts/initialize-rn-project.mjs <project-id>
```

它会改写 `package.json` 的 name、`app.json` 的 name / slug / scheme、两份 i18n 的 `app.title`，生成
`.agents/rn-project.md`，并把 AGENTS 的骨架状态切成项目状态。清单见
`docs/initialization/rn-app-initialization.md`。

## 运行

```bash
pnpm install
pnpm env:init dev        # 生成 env/.env.development（同样支持 test / prod / staging / mock）
pnpm dev                 # = dev:development，用 node --env-file 注入 env 文件后启动 Expo
```

`env:init` 只复制 `env/.env.<environment>.example`，真实取值写入被 gitignore 的
`env/.env.<environment>`；`dev` 映射 development、`prod` 映射 production。

`pnpm start` / `pnpm ios` / `pnpm android` 是不注入 env 的裸 Expo 命令，只在已自行导出
`EXPO_PUBLIC_*` 的终端里可用；业务联调请用 `pnpm dev:development` 或 `pnpm dev:mock`。

本地打包与 EAS 云构建共用同一套环境契约：

```bash
pnpm build:staging       # node --env-file=env/.env.staging scripts/build-env.mjs
pnpm build:production    # node --env-file=env/.env.production scripts/build-env.mjs
npx eas build --profile staging
npx eas build --profile production
```

`scripts/env-utils.mjs` 负责 `__LAN_IP__` 替换、过滤 Expo 进程环境并设置 `EXPO_NO_DOTENV=1`；
`eas.json` 的三个 profile 必须与 `env/.env.<environment>.example` 的 `EXPO_PUBLIC_*` 保持一致，
由 `src/test/architecture/eas-release-config.test.ts` 守护。

骨架只提供发布规范、脚本与 profile 配置，不在骨架仓执行 EAS 云端构建；签名、商店凭据、
`expo prebuild` 原生工程和真实出包属于正式项目接入与发版时的工作。

依赖版本按 Expo SDK 对齐；升级时用 `npx expo install --fix` 让 Expo 校准原生依赖，不要手工跳版本。

**两个依赖被刻意钉在小版本上**：`@tanstack/react-query@5.108.3` 与 `i18next@27.2.4`。更新的版本发布不足
24 小时，会被 pnpm 的供应链策略（`minimumReleaseAge`）拒绝，导致 `pnpm install --frozen-lockfile`
报「Lockfile failed supply-chain policy check」。等新版本满足时长后再放开。

## 门禁

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint，含 I 前缀 interface、no-console、no-restricted-imports
pnpm test           # jest + jest-expo + @testing-library/react-native
pnpm format:check
pnpm check:hygiene  # 仓库卫生：env、密钥、体积、包管理器混用
pnpm check:logs     # 日志事件目录：dot.case + 必须登记
pnpm check:gates    # 门禁自检：脚本、CI、架构测试、变体绑定
pnpm quality:check  # 一键跑完全部门禁
```

测试约定：

- 测试文件放 `src/test/**/*.test.ts?(x)`，`jest.config.js` 用 `jest-expo` 预设。
- `tsconfig.json` 的七组 alias（`@app` / `@api` / `@components` / `@domain` / `@storage` / `@theme` /
  `@test`）在 `jest.config.js` 的 `moduleNameMapper` 里一一对应；`@/*` 仅作兜底，业务代码不应再使用。
- 组件测试统一用 `@test/utils/test-providers` 的 `TestProviders`，不要在测试里直接 `new QueryClient()`。
- `@testing-library/react-native` v14 的 `render` 是 **async**，必须 `await`，否则 `screen` 不会被绑定。
- Query 测试里把 `retry` 关掉、`gcTime` 设为 `0`，避免残留定时器让 Jest 无法退出。

## 架构守卫

架构测试用静态扫描守住规则，违反即失败：

| 约束                   | 测试                                   | 检查方式                                                                                |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `app/` 只做路由壳      | `layer-boundary.test.ts`               | 禁止 `@api`、`@storage`，禁止出现 `fetch(`                                              |
| `src/domain/` 不碰视图 | `layer-boundary.test.ts`               | 禁止 `react-native`、`react-native-paper`、`expo-router`、`@components`                 |
| `src/api/` 只依赖契约  | `layer-boundary.test.ts`               | 允许 `@domain/contracts`，禁止其它 `@domain`、UI、storage                               |
| storage 边界唯一       | `layer-boundary.test.ts`               | 只有 `src/storage/**` 可导入 `expo-secure-store` 与 `async-storage`                     |
| 图片/网络边界          | `network-boundary.test.ts`             | 只有 `image.tsx` 可 import `expo-image`，只有 `network-store.ts` 可 import NetInfo      |
| 组件不直接取数         | `layer-boundary.test.ts`               | `src/components/**` 禁止 `fetch(`                                                       |
| alias 无冗余写法       | `layer-boundary.test.ts`               | `app/` 与 `src/` 不允许再出现 `@/` 开头的 import                                        |
| alias 配置完整         | `alias-config.test.ts`                 | tsconfig 必须声明 7 组 alias + `@/*` 兜底，且 jest 映射一致                             |
| env 读取唯一入口       | `layer-boundary.test.ts`               | 只有 `src/api/config.ts` 可读 `process.env.EXPO_PUBLIC_*`                               |
| Paper 边界             | `paper-boundary.test.ts`               | 只有 `paper-controls.tsx`、`paper-theme-provider.tsx`、`paper-theme.ts` 可 import Paper |
| root layout 纪律       | `root-layout-discipline.test.ts`       | 根布局不出现 `useQuery` / `fetch(` / `@api` / `@storage`，且 ≤ 30 行                    |
| 测试 Provider 边界     | `test-provider-boundary.test.ts`       | 测试统一用 `TestProviders`，不得直接 `new QueryClient()`                                |
| 组件行数               | `file-split-boundary.test.ts`          | `app/` 与 `src/components/` 的 `.tsx` ≤ 500 行；451–500 行必须在债务清单登记            |
| 异步按钮状态           | `button-action-state-boundary.test.ts` | 触发异步的 `<Button>` 必须带 `loading` 或 `disabled`；primitive 由 `loading` 派生禁用   |
| App 身份               | `expo-app-identity.test.ts`            | name / slug / version / scheme 合规，iOS 与 Android 标识一致，店档自动递增版本号        |
| 启动资源               | `expo-app-assets.test.ts`              | `app.json` 引用的本地资源存在，图标为方形 PNG 且达到商店尺寸                            |

451–500 行的组件登记在 `src/test/architecture/architecture-debts.json`，条目必须写 `owner` 与 `plan`；
文件收敛到 450 行以下或已删除时要同步删条目，否则 `file-split-boundary.test.ts` 会判定为死条目。

## 尚未完成

- **原生工程未生成**：`android/` 与 `ios/` 尚未 `expo prebuild`，需要原生定制或上架前再生成。
- **图标是占位资源**：`assets/icon.png` 与 `assets/adaptive-icon.png` 只是模板占位，初始化项目后必须
  替换为正式品牌图标，再进店档构建。
