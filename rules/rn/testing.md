# 测试与 CI 规则

## 目的

本文件描述 React Native 项目的测试金字塔、Jest 配置、架构测试、ESLint 规则集、pre-commit 与 PR CI 门禁。

## 测试金字塔

```
       ┌──────────────┐
       │   E2E 抽样   │  少量、覆盖主链路（如启用 Maestro）
       └──────────────┘
      ┌────────────────┐
      │  Flow / Smoke  │  多 screen 联调
      └────────────────┘
     ┌──────────────────┐
     │   Component      │  单个 screen / primitive
     └──────────────────┘
    ┌────────────────────┐
    │   Unit / Domain    │  store、helper、adapter
    └────────────────────┘
  ┌────────────────────────┐
  │      Architecture      │  分层、命名、虚拟化、a11y 等静态门禁
  └────────────────────────┘
```

底层（Unit / Architecture）覆盖广而快；上层（E2E）覆盖窄但贴近真实。

## Jest 标准

### 框架

- Jest + `jest-expo` preset。
- `@testing-library/react-native` 用于组件测试。
- `@testing-library/jest-native` 用于 a11y / state 断言。

### 文件位置

| 测试类型                    | 位置                                          |
| --------------------------- | --------------------------------------------- |
| API client / endpoint smoke | `src/test/api/*`                              |
| Domain store / helper       | `src/test/domain/*`                           |
| Storage wrapper             | `src/test/storage/*`                          |
| UI primitive / screen       | `src/test/components/*`                       |
| Provider / hook             | `src/test/providers/*`                        |
| Navigation                  | `src/test/navigation/*`                       |
| 架构边界                    | `src/test/architecture/*`                     |
| Flow（多 screen 联调）      | `src/test/components/<feature>-flow.test.tsx` |

### 命名

- 测试文件命名匹配被测对象：`button.test.tsx` 对应 `button.tsx`。
- `describe` 块使用业务语义：`describe('Button', ...)`。
- `it` 名使用 "should..." 或 "behaves as..." 风格：`it('shows loading label when loading is true', ...)`。

### 运行命令

```bash
# 跑全部
pnpm test

# 跑指定文件
pnpm test -- src/test/components/<feature>-screen.test.tsx

# 跑指定目录
pnpm test -- src/test/architecture/
```

### Open handle 与 cleanup

- 测试必须能干净退出，不依赖 `--forceExit`。
- Provider / hook 中的 timer、subscription、AppState listener 必须在 unmount 时清理。
- 如发现 open handle，先排查实现而非加 `--forceExit`。

### Mock 约定

- 平台模块（`expo-secure-store`、`@react-native-async-storage/async-storage`、`expo-clipboard`、`expo-web-browser`）在测试入口 `jest.mock` 替换为内存实现。
- API endpoint mock 走 `setupTests.ts` 或具体 test 内 `jest.spyOn`。
- 不在测试中调真实网络。

## Component 测试

### 基本模式

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TestProviders } from '@test/utils/test-providers';
import { FeatureListScreen } from '@components/<feature>/feature-list-screen';

describe('FeatureListScreen', () => {
  it('renders empty state when no items', async () => {
    render(
      <TestProviders>
        <FeatureListScreen />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('feature-list-empty')).toBeOnTheScreen();
    });
  });

  it('runs the primary action on press', async () => {
    // ...
  });
});
```

### TestProviders

`src/test/utils/test-providers.tsx` 提供 QueryClient / Theme / Locale 等 Provider 的测试版本，避免每个测试重复 mock。
组件测试不得直接 `new QueryClient()`；统一使用 `TestProviders` 或 `createTestQueryClient()`。测试专用 QueryClient 默认设置 `gcTime: 0` 和 `retry: false`，避免 React Query 缓存回收定时器让 Jest 在断言通过后留下 open handle。该约束由 `src/test/architecture/test-provider-boundary.test.ts` 守护。

### testID

- 测试通过 `testID` 选择元素：稳定、不受文案变化影响。
- 优先 `testID` > `accessibilityLabel` > 文本内容。

### Loading / Error / Empty

每个 query 驱动的 screen 必须测试三态渲染。

## 架构测试

### 推荐门禁类型

公司规范只定义需要守护的边界类型，不在规则正文登记某个项目的实际测试文件清单。每个 App 应在项目本地 todo / executing record / 架构测试目录 README 中维护自己的 gate inventory，并保持与 `src/test/architecture/` 实际文件一致。

| 门禁类型          | 守护内容                                                            |
| ----------------- | ------------------------------------------------------------------- |
| 分层边界          | app / components / domain / api / storage 单向依赖                  |
| 文件拆分          | screen / 复杂组件超过阈值时必须拆分或登记 owner                     |
| TypeScript shape  | 对象 shape 默认使用 `interface I*`，DTO 豁免集中管理                |
| 导航类型安全      | 禁止在 safe navigation helper 外使用 `as Href`                      |
| UI primitive 边界 | 业务代码不直接 import 底层 UI provider 组件                         |
| 图片边界          | 业务图片统一走 image wrapper，不直接使用 RN `Image`                 |
| Storage 边界      | 平台 storage 只能通过 `src/storage/*` wrapper 接入                  |
| Logger 边界       | 业务代码禁止直接 `console.*`，统一走 logger                         |
| 长列表虚拟化      | 业务长列表使用 FlatList / SectionList 与性能常量                    |
| 可访问性          | Pressable、IconButton、Input、动态文本等具备基础 a11y 语义          |
| Native action     | Clipboard / Linking / WebBrowser / Share 有失败反馈与 safe-url 校验 |
| Root layout       | root layout 只挂载启动基础设施，不引入业务请求或 storage            |
| Release config    | EAS profile、env file、App identity、资源与发布清单一致             |

项目如需要共享 registry helper（例如长列表 source registry），helper 留在 `src/test/architecture/*`，并由项目本地清单说明用途。

模版见 `docs/rules/rn/templates/architecture-test.md`。

### 守护原则

- 架构测试是规则的可执行表达。
- 不允许"为了绕过失败实现而放宽测试"。
- 新增规则时同步补测试。
- 测试失败时优先修代码，而非改测试。

## ESLint 规则集

### 标准规则

`eslint.config.js` 启用：

- `eslint-config-expo/flat`（Expo 官方推荐）
- `react-hooks/rules-of-hooks`：`error`
- `react-hooks/exhaustive-deps`：`error`
- `no-restricted-imports`：`error`（含 Paper / storage / 冗余 alias 边界）
- `import/order`：`error`
- `no-console`：`error`（logger / test / scripts 按配置豁免）
- `@typescript-eslint/consistent-type-imports`：`error`

### 推荐扩展

按优先级分批收敛；新增规则应先清理 warning，再提升为 CI 门禁：

| 规则                                         | 用途                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `react-hooks/exhaustive-deps`                | hook 依赖数组必填                                                                                |
| `no-restricted-imports`                      | 禁止 `../`、禁止业务代码 `react-native-paper`、禁止跨边界 storage、禁止 `@/<dir>/*` 等冗余 alias |
| `import/order`                               | import 分组顺序：node → 第三方 → `@xxx/*` → `./xxx`                                              |
| `no-console`                                 | 白名单 logger / test / scripts 外禁止 console                                                    |
| `@typescript-eslint/consistent-type-imports` | 强制 `import type`                                                                               |

### 配置示例

```js
// eslint.config.js
module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../*'], message: '使用 alias 而非相对路径跨目录 import' },
            { group: ['@/api/*', '@/components/*', '@/domain/*'], message: '使用无斜杠 alias' },
          ],
          paths: [
            { name: 'react-native-paper', message: '业务代码使用 @components/ui wrapper' },
            { name: 'expo-secure-store', message: '使用 src/storage/* wrapper' },
            {
              name: '@react-native-async-storage/async-storage',
              message: '使用 src/storage/* wrapper',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/api/logger.ts', 'src/test/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: [
      'src/components/ui/paper-controls.tsx',
      'src/components/providers/paper-theme-provider.tsx',
      'src/theme/paper-theme.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/storage/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
```

### Lint 命令

```bash
pnpm lint
```

CI 必须跑 lint 且 `--max-warnings=0`。

## Pre-commit Hook

### Husky + lint-staged

`package.json`：

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --check", "eslint --max-warnings=0"]
  }
}
```

`.husky/pre-commit`：

```bash
#!/usr/bin/env sh
pnpm exec lint-staged
```

- pre-commit 只跑 changed files 的 lint + prettier。
- typecheck 与 jest 留到 pre-push 或 CI（pre-commit 太慢）。

## PR CI 门禁

`.github/workflows/ci.yml`（或等价 CI）必须跑：

| 步骤     | 命令                             |
| -------- | -------------------------------- |
| 安装依赖 | `pnpm install --frozen-lockfile` |
| 类型检查 | `pnpm typecheck`                 |
| Lint     | `pnpm lint:strict`               |
| 单测     | `pnpm test`                      |

PR 不允许 merge until 4 项全绿。

### PR 描述模板

`.github/PULL_REQUEST_TEMPLATE.md`：

```markdown
## Summary

<1-3 bullets>

## Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint:strict`
- [ ] `pnpm test`
- [ ] 平台手测（如涉及 UI / native action）

## Release Impact

- Bundle size diff: iOS JS bundle `TBD -> TBD`, Android JS bundle `TBD -> TBD`, assets `TBD -> TBD`.
- Store-bound artifact size: iOS `.ipa` `TBD`, Android `.apk` / `.aab` `TBD`.
- Release checklist impact: none / see project release checklist.
```

## E2E（可选）

### 默认基线

E2E 自动化默认可选。若尚未引入自动化，发布候选必须依赖项目发布清单完成平台手测；PR CI 至少覆盖 typecheck / lint / Jest，主链路由平台验收承担。

发布候选必须手测并记录：

```text
home → primary listing/detail → primary action → external handoff（如有）→ result / confirmation
```

记录内容写入项目发布清单的 Platform Acceptance；未记录平台验收证据时，不得把发布候选标记为已通过。

### 触发评估

满足以下任一条件时评估引入：

- 主链路频繁回归 bug。
- 发版节奏加快，手测成为瓶颈。
- 业务方对发版质量有更高要求。
- 新外部通道、核心交易 / 提交流程大改，或外部沙箱可稳定自动化。
- 用户基数与发版频率达到手测成本不可接受的阶段。

### 候选工具

- **Maestro**（推荐）：YAML 流脚本，跨平台，CI 友好。
- **Detox**：原生集成，性能好但配置复杂。
- **Appium**：跨语言，但 RN 集成略显笨重。

如启用，至少覆盖：

```
home → primary listing/detail → primary action → external handoff（如有）→ result / confirmation
```

CI 触发：PR / nightly / pre-release。

## 门禁取舍与基线

> 本节记录测试 / CI 门禁的标准取舍，明确哪些是有意选择而非遗漏，避免重复评估。

- **APM / 崩溃上报**：标准不强制接入 Sentry / Bugsnag 等 APM SDK；未接入期间以本地 diagnostics（日志持久化 + 用户主动上传）作为问题排查兜底，`IErrorReporter` 注入点常驻，业务方决定接入时按 `docs/rules/rn/observability.md` drop-in。无 APM 是有意取舍，不计为缺口。
- **E2E 自动化**：标准以「Jest 多屏 Flow 测试覆盖主链路 + 发布清单平台手测」为默认基线，不强制引入 Maestro / Detox；引入触发条件见上方 E2E 小节。E2E 自动化（设备级）可选，但主链路的 Jest Flow 测试为必须（见下）。
- **覆盖率门禁**：`jest.config.js` 已配置 `collectCoverageFrom` 与 `coverageThreshold`，只统计共享层（`src/api`、`src/domain`、`src/theme`、`src/components/ui`），基线取实测值下浮 2 个点；`pnpm test:coverage` 是 `quality:check` 与 CI 的一部分。项目可按关键域（支付 / 下单 / API client）再设更高门槛，基线随测试增长逐步抬高，不一次设理想值导致 CI 长红。
- **构建产物冒烟**：CI 除 typecheck / lint / 单测外，应包含一步构建产物冒烟（如 `expo-doctor` / `expo export` / `prebuild` 干跑），在 PR 阶段暴露 `app.json`、plugin、依赖、native 配置错误，而非留到发布。详见 `docs/rules/rn/release.md`。
- **主链路 Flow 测试**：钱链路 / 核心提交链路必须有 Jest 多屏 Flow 测试（多 screen、mock API、断言到结果态），作为 E2E 的自动化替代；并以架构测试守护其文件存在，防止被静默删除。

## 完成检查

- 测试文件位置符合金字塔分类。
- 关键 screen 覆盖 loading / error / empty 三态测试。
- 架构测试覆盖所有项目硬规则。
- ESLint 规则集启用 `exhaustive-deps` / `no-restricted-imports` / `import/order` / `no-console`。
- `pnpm test` 不依赖 `--forceExit` 也能干净退出。
- Pre-commit hook 与 PR CI 4 项门禁就位。
