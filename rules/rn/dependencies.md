# 依赖与升级规则

## 目的

本文件描述 React Native 项目的依赖引入流程、Expo SDK 升级节奏、native module 评估、`patch-package` 政策与 lock file 审查。

## 工具链版本(Node / pnpm)

RN 不继承前端通用层规则，因此工具链版本在这里单独约定，且与 SPA/SSR 变体保持一致：

| 项   | 权威来源                                        | 取值                            |
| ---- | ----------------------------------------------- | ------------------------------- |
| Node | 仓库根 `.nvmrc` + `package.json` `engines.node` | 24(`engines` 写 `>=24.0.0 <25`) |
| pnpm | `package.json` `packageManager`                 | `pnpm@12.4.1`                   |

- CI 用 `node-version-file: .nvmrc` 读 Node，用根 `packageManager` 决定 pnpm，不在 workflow 里写死版本。
- GitHub Action 必须跑在 node24 运行时（`actions/checkout`、`actions/setup-node`、`pnpm/action-setup` 均不低于 `v5`）。
- Expo SDK 有自己的 Node 下限；升级 Expo 前先确认 `.nvmrc` 仍满足，不满足就整体提 Node 大版本并同步三处声明。
- `node scripts/verify-gates.mjs` 校验 `.nvmrc`、`engines.node` 与 CI 配置一致。

## 依赖引入流程

### 引入前评估

引入新依赖前，按以下顺序检查替代方案：

1. 现有项目代码能否实现？
2. RN / Expo 内置模块能否覆盖？
3. 现有第三方依赖是否已能满足？
4. 真的需要新依赖时，按"native module 评估表"选包。

### Native Module 评估表

按优先级排序，复杂度递增：

| 类型                            | 例子                                                                           | 接入复杂度                      | Expo Go 支持        |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------- | ------------------- |
| 1. `expo-*` 官方包              | `expo-clipboard`、`expo-web-browser`、`expo-secure-store`、`expo-localization` | `npx expo install xxx`          | 是                  |
| 2. 纯 JS 包（无 native）        | `@tanstack/react-query`、`zustand`、`i18next`                                  | 普通 npm install                | 是                  |
| 3. 社区 RN 包 + config plugin   | `react-native-mmkv`、`react-native-firebase`                                   | 装包 + `app.json` plugins       | 否（需 dev client） |
| 4. 社区 RN 包，无 config plugin | 旧 native module                                                               | 必须 `expo prebuild` 改原生工程 | 否（不可逆变 bare） |

**选包决策**：

- 优先级：1 → 2 → 3 → 4。
- 引入第 3、4 类必须有 ADR（决策记录），说明为什么不能用前面层级的等价方案。
- Expo managed workflow 项目引入第 4 类会变 bare workflow，整个工程模型变化（CI / EAS / dev 流程都受影响），必须慎重。

### 引入新依赖 PR 必含

- 包名、版本、许可证（MIT / Apache 2.0 / ISC 为友好）。
- 选包理由（为什么不用现有替代）。
- bundle size 增量（用 `npx source-map-explorer` 或 EAS Build 报告估算）。
- 维护状态：最近 commit 时间、issue 数量、社区活跃度。
- 安全：CVE 历史、`npm audit` 结果。

## Expo SDK 升级

### 升级节奏

- Expo 每年发布 1–2 个大 SDK。每个 SDK 锁定一组 React Native 与配套 `expo-*` 包的版本。
- 每年至少升级 1 次 SDK；不晚于上一个 SDK 进入弃用窗口。
- 升级时跟随官方 Expo SDK upgrade guide。

### 升级流程

1. 创建 `expo-sdk-upgrade` 分支。
2. `npx expo install expo@latest --fix`：升级 Expo SDK 与所有 `expo-*` / RN 相关包到匹配版本。
3. 跑 `pnpm typecheck` + `pnpm lint` + `pnpm test`；逐项修复。
4. 模拟器 + 真机各跑一次主链路（home → primary action → result / confirmation）。
5. PR 描述详列 breaking changes 与 migration 步骤。
6. 合并后 staging 灰度一周再 production。

### 升级期间不交付新业务

- SDK 升级期间不在同一分支做业务功能。
- 升级 PR 独立 review。

## Patch-package 政策

### 适用场景

- 上游有 issue 或 PR 已提交但未发布。
- 业务紧急 unblock。

### 不适用场景

- 长期魔改三方代码（fork 一个或换包）。
- 没有 issue / PR 锚点的"经验性修补"。

### 流程

1. 改 `node_modules/<pkg>/...`。
2. `npx patch-package <pkg>` 生成 `patches/<pkg>+<version>.patch`。
3. PR 描述附上：
   - 上游 issue / PR 链接。
   - 为什么不能等上游发布。
   - 何时复查（如：每季度 / 上游下个版本）。
4. `patches/` 目录 commit。
5. `package.json` 添加 postinstall hook：`"postinstall": "patch-package"`。

### 季度复查

每季度跑一次：

- 列出所有 `patches/` 下文件。
- 检查上游是否已发布修复。
- 已发布 → 升级该包 + 删 patch + commit。

## Lock File 审查

### `pnpm-lock.yaml`

- 每次 PR 含 lock diff 时，reviewer 必须明确审过。
- 不允许在不更新 `package.json` 的情况下重生成 lock。
- 锁定 registry source；如使用公司镜像，CI 中明确配置。

### Registry

- 默认 `https://registry.npmjs.org/`。
- 如使用公司镜像，所有开发者 / CI 配置一致。
- 不允许 `.npmrc` 中含个人 token（用环境变量注入）。

## Dependency 分类

`package.json` 区分：

- `dependencies`：运行时依赖（含 RN / Expo / React Query / Zustand）。
- `devDependencies`：构建 / 测试 / lint 工具（含 jest / typescript / prettier / @testing-library）。

不要把测试库放 `dependencies`，也不要把运行时依赖放 `devDependencies`。

## 版本管理

### 默认使用最新稳定版

- 新引入依赖时**默认拉取最新稳定版**（avoid 预发布版 `alpha` / `beta` / `rc`）。
- 关键依赖（`react`、`react-native`、`expo`、`react-dom`）跟随 Expo SDK 锁定的版本，不单独升级（详见下文"Expo SDK 升级"）。
- 其他依赖使用 `^x.y.z`（minor 自动升级）。
- 严格锁定（`x.y.z` 精确版本）仅用于：
  - 有过 breaking change 历史的包。
  - 业务自定义 patch 的包。

### Peer dependencies

- 引入新包时检查 `peerDependencies` 是否与现有版本兼容。
- 不兼容时升级所有相关包到匹配版本，或选其他包。

### 不写死历史版本号

规则、文档与模版中**不引用具体版本号**（如"RN 0.83"），只描述行为与约束。项目实际版本以 `package.json` 为准。文档语义使用"最新稳定版"。

## 包大小监控

### Bundle Analyzer

发版前用 `npx source-map-explorer` 或 EAS Build 报告分析 bundle 组成。

### 大包识别

| 包类型          | 上限（参考） |
| --------------- | ------------ |
| 单个第三方      | ≤ 200 KB     |
| 单个 `expo-*`   | ≤ 300 KB     |
| 总 node_modules | ≤ 300 MB     |

超出时评估替代：

- 找更轻量的同类包。
- 按需 import（如 `lodash-es` 替代 `lodash`）。
- Tree shake（确保是 ESM）。

## APM SDK 选型

错误上报与性能 APM SDK 选型见 `docs/rules/rn/observability.md`。默认不预设具体 SDK；触发引入时按本规则评估。

候选：

- **Sentry**：功能全、有免费档、RN 集成成熟。**推荐**。
- **Bugsnag**：商业，体验好。
- **Crashlytics**：免费、Firebase 生态。
- **Datadog RUM**：与后端日志统一，但贵。

引入流程：

1. 比较候选并写决策记录。
2. 接入 `IErrorReporter` adapter（实现 `captureException` / `captureMessage`）。
3. `setErrorReporter` 在 root provider 注入。
4. 验证敏感字段 redaction 仍生效。

## 安全审计

### npm audit

CI 中跑 `pnpm audit --audit-level=high`：

- High / Critical 漏洞必须修复或显式 ignore + 原因。
- Low / Moderate 周期内修复。

### 依赖更新自动化

可选：

- Dependabot / Renovate 自动 PR。
- 自动 PR 仅 patch / minor 自动 merge；major 必须人工 review。

## 完成检查

- 引入新依赖按评估表选包，附 ADR。
- Expo SDK 升级独立 PR，不混业务功能。
- `patches/` 中每个 patch 有上游 issue / PR 链接 + 复查时间。
- lock file 变更 PR 必须 reviewer 审过。
- `package.json` 中 dependencies / devDependencies 分类正确。
- 关键包版本跟随 Expo SDK。
- CI 跑 `pnpm audit` 高危漏洞修复。
