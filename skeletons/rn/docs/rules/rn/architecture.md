# 架构规则

## 目的

本文件描述 React Native 应用的标准分层架构、目录归属与边界约束，是所有 RN 应用必须遵守的最高层架构契约。

## 分层模型

严格遵循单向依赖：

```
app/ (路由壳)
  └─→ src/components/ (UI 层)
        └─→ src/domain/ (业务逻辑层)
              └─→ src/api/ (网络层) | src/storage/ (持久化层)
```

每一层只能向下依赖，禁止向上或同层环依赖。

## 目录职责

| 目录                         | 职责                                                                    | 严格禁止                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/*`                      | Expo Router 路由入口；只处理路由参数、导航分组、modal / static / tab 壳 | `fetch` 调用、`import @api/*`、拼接 API URL、业务计算、读取 storage                                                                              |
| `src/components/*`           | screen、业务组件、UI primitive wrapper、Provider、Native action         | `fetch` 调用、拼接 API URL、直接 `import 'react-native-paper'`、直接读取平台 storage                                                             |
| `src/components/ui/*`        | 共享 UI primitive 与 Paper wrapper                                      | 含业务语义、依赖 `domain/*`                                                                                                                      |
| `src/components/providers/*` | 全局 Provider（UI 相关）                                                | 业务状态管理                                                                                                                                     |
| `src/domain/*`               | 业务模型、store、adapter、i18n、analytics、formatter                    | `import` RN 视图组件（`Text` / `View` / `ScrollView` 等）、`import 'react-native-paper'`、`import 'lucide-react-native'`、`import @components/*` |
| `src/api/*`                  | 请求 shape、API client、endpoint wrapper、API error                     | `import` UI / store / storage；读取 SecureStore / AsyncStorage                                                                                   |
| `src/api/endpoints/*`        | 单 API operation 的 wrapper                                             | UI fallback、业务转换                                                                                                                            |
| `src/storage/*`              | SecureStore 与 AsyncStorage 的唯一直接边界                              | 业务逻辑、UI 依赖                                                                                                                                |
| `src/theme/*`                | 品牌 token、Paper theme 映射、主题 Provider                             | 业务依赖                                                                                                                                         |
| `src/test/*`                 | 单测、契约测试、组件测试、架构测试、storage 测试、flow 测试             | 生产代码依赖                                                                                                                                     |
| `mock/*`                     | OpenAPI 契约与 Prism mock                                               | 任何运行时代码引用                                                                                                                               |
| `docs/*`                     | 规范、模版、todo、执行记录、发布文档                                    | 运行时代码引用                                                                                                                                   |

## Provider 归属

- **业务状态 Provider**（含 React hook、订阅 store、调 API）放在 `src/domain/*`：例如 session restore、analytics bridge、locale provider、toast queue manager。
- **UI 相关 Provider**（含 RN 视图组件、Paper theme、SafeArea）放在 `src/components/providers/*`：例如 PaperProvider wrapper、ThemeProvider、ErrorBoundary、root Provider 组合器（`app-providers.tsx`）。
- 判断标准：是否需要 `import 'react-native'` 的 view 组件或 `react-native-paper`？是 → `src/components/providers/*`，否 → `src/domain/*`。

## 目录归属决策矩阵

新增文件时按下表决策放在哪里：

| 文件类型              | 是否含 RN 视图组件  | 跨 feature 复用  | 归属                                                                                         |
| --------------------- | ------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| Screen 主文件         | 是                  | 否               | `src/components/<feature>/<screen>-screen.tsx`                                               |
| 业务子组件            | 是                  | 否（feature 内） | `src/components/<feature>/<component>.tsx`                                                   |
| 跨 feature 复用 UI    | 是                  | 是               | `src/components/ui/<primitive>.tsx`                                                          |
| Provider（UI 相关）   | 是                  | 是               | `src/components/providers/<provider>.tsx`                                                    |
| Provider（业务状态）  | 否                  | 是               | `src/domain/<area>-provider.tsx`                                                             |
| 业务 hook             | 否（hook 内不渲染） | 视情况           | `src/components/<feature>/use-<name>.ts`（局部）或 `src/domain/<area>/use-<name>.ts`（共享） |
| Store（Zustand）      | 否                  | 是               | `src/domain/<area>.ts` 或 `src/domain/<area>/store.ts`                                       |
| Helper / formatter    | 否                  | 是               | `src/domain/<area>/<helper>.ts`                                                              |
| API endpoint wrapper  | 否                  | 是               | `src/api/endpoints/<resource>.ts`                                                            |
| API contract / DTO    | 否                  | 是               | `src/domain/contracts/<resource>.ts`                                                         |
| 同 screen 私有 helper | 否                  | 否               | `src/components/<feature>/<screen>-screen.tools.ts`                                          |

## 架构测试守护

以下测试是分层契约的可执行表达，禁止为了绕过失败实现而放宽测试：

- `src/test/architecture/layer-boundary.test.ts`：扫描 `import` 语句，强制路由、组件、API、domain 与 storage 的单向依赖；其中 domain 可承载业务状态 Provider 和 React hook，但不得依赖 RN 视图组件、Paper、lucide 或 components 层。
- `src/test/architecture/file-split-boundary.test.ts`：扫描组件文件大小，超阈值必须登记到收敛 todo。
- 其它架构测试见 `docs/rules/rn/testing.md`。

## 路由入口约束

- `app/_layout.tsx`：仅挂载 root Provider 组合 + Stack + StatusBar；不允许 `useQuery`、`fetch`、`import @api/*` / `@storage/*`。详见 `docs/rules/rn/startup.md`。
- `app/(tabs)/`、`app/(auth)/`、`app/(modals)/`、`app/(static)/`：路由分组壳，仅声明 Stack screens 与 modal options。
- 每个 `app/*/[*].tsx` 路由文件只做：读取 `useLocalSearchParams`、把参数透传给 `@components/<feature>/<screen>-screen.tsx`。不允许业务计算。

## Feature 目录归属

- `src/components/<feature>/*`（如 `auth/`、`home/`、`settings/`）：单一 feature 内的 screen 与组件聚合。新增 feature 默认走这条路径。
- `src/components/ui/*`：跨 feature 复用的 UI primitive。当一个组件被两个以上 feature 使用且无业务语义时，迁移到这里。
- 不允许在 `src/components/` 根目录直接放 feature 组件；必须挂在 feature 子目录或 `ui/` 下。
