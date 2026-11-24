# RN Application Skeleton

基于 Expo + expo-router 的 React Native 骨架。目录遵循 `docs/rules/rn/architecture.md` 的分层契约：

```text
app/                 expo-router 路由壳，只处理路由与壳层
src/components/      UI 层：screen、业务组件、ui primitive、Provider
src/domain/          业务逻辑：contracts、i18n、theme、store、formatter
src/api/            网络层：client 与 endpoints
src/storage/        持久化边界（当前为空，按需建）
src/test/           测试（尚未引入）
docs/rules/rn/      规范与代码模板
```

## 运行

```bash
pnpm install
cp .env.example .env.local   # 按本地后端地址调整 EXPO_PUBLIC_API_BASE_URL
pnpm start                   # 或 pnpm ios / pnpm android
```

依赖版本按 Expo SDK 对齐；升级时用 `npx expo install --fix` 让 Expo 校准原生依赖，不要手工跳版本。

**两个依赖被刻意钉在小版本上**：`@tanstack/react-query@5.108.3` 与 `i18next@27.2.4`。更新的版本发布不足
24 小时，会被 pnpm 的供应链策略（`minimumReleaseAge`）拒绝，导致 `pnpm install --frozen-lockfile`
报「Lockfile failed supply-chain policy check」。等新版本满足时长后再放开。

## 门禁

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint，含 I 前缀 interface 与 no-console
pnpm test           # jest + jest-expo + @testing-library/react-native
pnpm format:check
pnpm check:hygiene  # 仓库卫生：env、密钥、体积、包管理器混用
pnpm check:gates    # 门禁自检：脚本、CI、架构测试、变体绑定
pnpm quality:check  # 一键跑完全部门禁
```

测试约定：

- 测试文件放 `src/test/**/*.test.ts?(x)`，`jest.config.js` 用 `jest-expo` 预设，`@/*` 由
  `moduleNameMapper` 映射到 `src/*`。
- `@testing-library/react-native` v14 的 `render` 是 **async**，必须 `await`，否则 `screen` 不会被绑定。
- Query 测试里把 `retry` 关掉、`gcTime` 设为 `Infinity`，避免残留定时器让 Jest 无法退出。

## 架构守卫

`src/test/architecture/layering.test.ts` 用静态扫描守住分层契约，违反即测试失败：

| 约束                   | 检查方式                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| `app/` 只做路由壳      | 禁止导入 `@/api`、`@/storage`，禁止出现 `fetch(`                             |
| `src/domain/` 不碰视图 | 禁止导入 `react-native`、`react-native-paper`、`expo-router`、`@/components` |
| `src/api/` 只依赖契约  | 允许 `@/domain/contracts`，禁止其它 `@/domain`、UI、storage                  |
| storage 边界唯一       | 只有 `src/storage/**` 可导入 `expo-secure-store` 与 `async-storage`          |
| 组件不直接取数         | `src/components/**` 禁止 `fetch(`                                            |

写这套测试时它当场抓到一个真实违规：`src/domain/theme/paper-theme.ts` 导入了 `react-native-paper`，
按规则主题映射应放 `src/theme/`——已搬迁。

## 尚未完成

- **初始化技能**：`initialize-rn-project` 未建，当前需手工改 `package.json` 与 `app.json` 的应用名。
