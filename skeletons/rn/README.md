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

## 门禁

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint，含 I 前缀 interface 与 no-console
pnpm format:check
pnpm check:hygiene  # 仓库卫生：env、密钥、体积、包管理器混用
```

## 尚未完成

- **测试栈**：RN 需要 `jest-expo` + `@testing-library/react-native`，本骨架暂未引入，因为当前环境无法安装
  原生依赖做真实验证；接入前不要声称 `pnpm test` 可用。
- **`check:gates`**：`verify-gates.mjs` 依赖架构测试目录与 SPA/SSR 的 ESLint 规则，RN 尚未适配，
  因此没有接入；补齐测试栈后一并处理。
- **初始化技能**：`initialize-rn-project` 未建，当前需手工改 `package.json` 与 `app.json` 的应用名。
