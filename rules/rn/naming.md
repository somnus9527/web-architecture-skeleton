# 文件与符号命名规则

## 目的

本文件描述 React Native 项目中文件、目录与导出符号的命名约定。

## 文件命名

### 通用：kebab-case

所有源代码文件使用全小写连字符（kebab-case），不允许 PascalCase 或 camelCase 文件名：

```
feature-dashboard-screen.tsx
use-feature-summary.ts
flat-list-performance.ts
api-client.test.ts
```

### 例外

- `app/*` 路由文件遵循 Expo Router 约定：`_layout.tsx`、`+not-found.tsx`、`[id].tsx`、`(group)/...`。
- 资源文件（图片、字体）使用 kebab-case 或仓库现有 asset 命名约定。
- 配置文件保留生态标准名：`app.json`、`tsconfig.json`、`eas.json`、`metro.config.js`。

## 文件名后缀语义

| 后缀                                   | 用途                              | 示例                           |
| -------------------------------------- | --------------------------------- | ------------------------------ |
| `-screen.tsx`                          | Expo Router 路由的 screen 主组件  | `feature-dashboard-screen.tsx` |
| `-section.tsx`                         | 页面内业务区块（多个组成 screen） | `home-hero-section.tsx`        |
| `-card.tsx` / `-row.tsx` / `-cell.tsx` | 业务卡片 / 行 / 单元              | `entity-card.tsx`              |
| `-provider.tsx`                        | Provider 组件                     | `session-provider.tsx`         |
| `-store.ts`                            | Zustand store                     | `locale-store.ts`              |
| `use-*.ts`                             | 共享 hook                         | `use-feature-summary.ts`       |
| `*.tools.ts`                           | 同 screen 私有 helper             | `register-screen.tools.ts`     |
| `*.config.ts`                          | 同 screen 私有静态配置            | `register-screen.config.ts`    |
| `*.types.ts`                           | 同 screen 私有共享类型            | `register-screen.types.ts`     |
| `*.test.ts` / `*.test.tsx`             | Jest 测试                         | `feature-store.test.ts`        |
| `-boundary.test.ts`                    | 架构边界测试                      | `layer-boundary.test.ts`       |

## 目录命名

- 顶层目录：`app/`、`src/`、`docs/`、`mock/`、`assets/`、`scripts/`、`env/`、`.maestro/`（如启用）。
- `src/` 一级目录：`api/`、`components/`、`domain/`、`storage/`、`theme/`、`test/`。
- `src/components/` 二级目录：feature 名 kebab-case，如 `auth/`、`home/`、`settings/`、`notifications/`。
- `src/api/` 二级目录：`endpoints/`、`config.ts`、`client.ts`、`errors.ts` 等扁平。
- `src/domain/` 二级目录：业务领域 kebab-case，如 `locale/`、`session/`、`contracts/`。

## 导出符号命名

### 组件

- PascalCase 函数组件：`Button`、`EntityCard`、`FeatureDashboardScreen`。
- 默认 export 限于路由文件（`app/**/*.tsx` 可以 default export）；其他文件优先 named export。

### Hook

- 必须 `use` 前缀 + camelCase：`useFeatureStore`、`useThemeTokens`、`useAppToast`。
- 自定义 hook 文件名遵循 `use-*.ts`，文件内导出与文件名匹配的 camelCase：`use-feature-summary.ts` 导出 `useFeatureSummary`。

### 函数

- camelCase，动词开头：`getThemeTokens`、`normalizeBaseUrl`、`buildLoginRedirectHref`、`adaptItemDetail`。
- 副作用类用动词短语：`pushNativeActionFailureToast`、`hydrateDraft`、`scheduleDeferredSections`。

### 常量

- 模块级常量 SCREAMING_SNAKE_CASE：`FEATURE_DRAFT_STORAGE_KEY`、`DEFAULT_RETRY_DELAY_MS`、`LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT`。
- 组件内局部常量使用 camelCase：`const variantStyleMap = { ... }`。

### Store

- Zustand store hook 命名 `use<Area>Store`：`useFeatureStore`、`useLocaleStore`、`useSessionStore`。
- Store 内 selector 函数命名 `get<Field>` 或语义化：`getSelectedItemCount`、`getVisibleItems`。

### Provider

- Provider 组件 PascalCase：`SessionProvider`、`LocaleProvider`、`ToastProvider`、`ThemeProvider`。
- Provider 内自定义 hook：`useAppTheme`、`useSession`、`useAppToast`。

### Test

- 测试文件命名匹配被测对象：`button.test.tsx` 对应 `button.tsx`。
- describe 块使用业务语义：`describe('Button', ...)`、`describe('architecture layer boundary', ...)`。

## 业务术语命名

避免歧义术语，使用项目统一词表：

| 业务概念        | 推荐命名                                         | 避免                                    |
| --------------- | ------------------------------------------------ | --------------------------------------- |
| 路由跳转目标    | `redirectTo`、`pathname`、`href`                 | `link`、`url`、`target`（在非链接场景） |
| 用户会话        | `session`、`authToken`                           | `user`（除非真指用户实体）              |
| 业务实体        | 项目业务名（如 `product`、`article`、`message`） | `item`（除非泛指列表项）                |
| 列表条目        | `item`、`listItem`、`<entity>Item`               | `data`、`record`                        |
| 加载态 / 错误态 | `isLoading`、`isError`、`error`、`isEmpty`       | `loading: true`（boolean 名缺前缀）     |

## Test ID 命名

- testID 使用 kebab-case：`testID="feature-list-empty"`、`testID="feature-summary-total"`。
- 同一 screen 的 testID 加业务前缀：`<feature>-<element>-<state>`。

## 完成检查

- 文件名 kebab-case；导出符号 PascalCase（组件）/ camelCase（其他）；常量 SCREAMING_SNAKE_CASE。
- 文件后缀语义正确：screen / provider / store / tools / config / types / test。
- 不出现意义不明的 `data`、`info`、`item`、`thing`、`stuff` 作为单独命名。
- testID 使用 kebab-case 且有业务前缀。
