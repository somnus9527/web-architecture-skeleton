# Project AGENTS

> 本文件是骨架自身的手工说明，不由物化脚本生成；`docs/rules/rn/` 才是由 `rules/rn/` 物化出的规则副本。
> 改规则请改 `rules/rn/`，不要直接改 `docs/rules/rn/`；改骨架说明再改本文件。

## 骨架状态

- 本仓库是可复制的 Expo RN 项目骨架，不是正式业务应用。
- 新应用复制后，必须先完成项目身份初始化，不得直接开始业务开发。

## Always-on

- 始终使用简体中文回复。
- 本仓库遵循公司统一的 React Native 应用开发规范。所有规则文件位于 `docs/rules/rn/`，所有可复用模版位于 `docs/rules/rn/templates/`。新加入的开发者从本文件出发即可读全规范，不需要外部资源。
- 技术栈基线：Expo Router + Expo SDK + React + React Native + TypeScript + React Query + Zustand + React Native Paper（仅作为底层 UI provider，业务侧通过 wrapper 使用）+ i18next + SecureStore + AsyncStorage + Jest + React Native Testing Library。所有依赖默认使用**最新稳定版**；具体版本由 `package.json` 锁定，升级遵循 `docs/rules/rn/dependencies.md`。
- 新增或修改手写 TypeScript / TSX / 脚本代码时，必须遵守本仓库分发的规则副本（`docs/rules/rn/*.md`），不再依赖本机全局规则。
- 修改代码、文档或代办前必须保护上下文输出，未知或可能很大的命令输出使用字节截断，例如 `COMMAND 2>&1 | head -c 4000`。

## Routing

开始任何开发、评审、修复或新功能前，按下表读取相关规则；不要凭历史经验绕过规则。

- 初始化项目身份：`.agents/skills/initialize-rn-project/SKILL.md`。
- 检查或同步上游架构规范：`.agents/skills/sync-architecture-rules/SKILL.md`，不得直接合并骨架分支。

### 架构基础

- **架构边界** — `docs/rules/rn/architecture.md`：分层模型、目录归属、目录归属决策矩阵、Provider 边界。
- **TypeScript 风格** — `docs/rules/rn/typescript.md`：interface / type / 命名前缀 / 泛型 / import alias 政策。
- **文件命名** — `docs/rules/rn/naming.md`：文件、目录、组件、hook、helper 命名规则。
- **组件拆分** — `docs/rules/rn/frontend.md`：screen 编排层职责、`tools.ts / config.ts / types.ts / hooks.ts` 同目录拆分、文件大小阈值。
- **注释规则** — `docs/rules/rn/comments.md`：函数、类型、TSX 区块注释要求。

### 数据与导航

- **路由与导航** — `docs/rules/rn/routing.md`：Expo Router 文件壳、typed routes、跳转类型安全（禁止 `as Href`）。
- **状态管理** — `docs/rules/rn/state-management.md`：React Query 默认配置、Query 三态、Zustand store 模式、AppState / focusManager 桥接。
- **API 与契约** — `docs/rules/rn/api.md`：API client、endpoint wrapper、契约 DTO、mock 流程。
- **存储边界** — `docs/rules/rn/storage.md`：SecureStore vs AsyncStorage、敏感字段存储矩阵。
- **网络与离线** — `docs/rules/rn/network-offline.md`：NetInfo 桥接、离线 UX、自动重连、慢网络。

### UI 与体验

- **UI 组件** — `docs/rules/rn/ui-components.md`：UI primitive 使用、Paper boundary、列表虚拟化清单。
- **主题与样式** — `docs/rules/rn/theme.md`：token 系统、样式 + token 消费模式、亮暗色。
- **图片资源** — `docs/rules/rn/images.md`：`expo-image` 使用、缓存、placeholder、白名单。
- **Native 动作** — `docs/rules/rn/native-actions.md`：Clipboard / Linking / WebBrowser / Share 统一入口。
- **WebView** — `docs/rules/rn/webview.md`：来源白名单、安全配置、JS bridge schema。
- **推送通知** — `docs/rules/rn/push-notifications.md`：权限申请、token 管理、payload 协议、deep link 联动。
- **国际化** — `docs/rules/rn/i18n.md`：locale 切换、fallback、RTL 基线。
- **可访问性** — `docs/rules/rn/accessibility.md`：`accessibilityRole / Label / State` 必填位置、触控目标、动态字号。
- **键盘与表单** — `docs/rules/rn/forms-keyboard.md`：`KeyboardAvoidingView`、`returnKeyType`、autofill、scroll-to-error。
- **性能与渲染** — `docs/rules/rn/performance.md`：memo、FlatList 引用稳定、动画选型。
- **错误处理** — `docs/rules/rn/error-handling.md`：韧性入口、错误处理金字塔、ErrorBoundary、Query 错误、Native action 失败、logger 上报衔接。

### 横切与运维

- **可观测性** — `docs/rules/rn/observability.md`：统一 logger、敏感字段 redaction、错误上报锚点。
- **诊断与日志上传** — `docs/rules/rn/diagnostics.md`：本地日志持久化、breadcrumb、用户主动上传诊断。
- **安全** — `docs/rules/rn/security.md`：deep link 白名单、URL 校验、OTA 决策、敏感字段处理。
- **启动 discipline** — `docs/rules/rn/startup.md`：`app/_layout.tsx` 准则、Provider 嵌套顺序、splash 隐藏时机。
- **发布与运行时配置** — `docs/rules/rn/release.md`：EAS profile、env file、bundle 预算。
- **应用版本更新** — `docs/rules/rn/app-version-update.md`：版本检查、强制 / 建议更新、跳转应用商店。
- **测试与 CI** — `docs/rules/rn/testing.md`：测试金字塔、Jest 命令、架构测试、ESLint 规则集、CI 门禁。
- **依赖与升级** — `docs/rules/rn/dependencies.md`：依赖引入流程、最新稳定版策略、native module 评估、`patch-package` 政策。

### 工作流

- **Todo 工作流** — `docs/rules/rn/todo-workflow.md`：todo 文件职责、执行记录、恢复规则。

## Templates

可复用代码模版位于 `docs/rules/rn/templates/`。规则在 `docs/rules/rn/*.md` 中描述"做什么、为什么"，模版给出"怎么做"的完整代码：

- **API Client** — `docs/rules/rn/templates/api-client.md`
- **Endpoint Wrapper** — `docs/rules/rn/templates/endpoint-wrapper.md`
- **Theme Tokens** — `docs/rules/rn/templates/theme-tokens.md`
- **UI Primitive 组件** — `docs/rules/rn/templates/ui-primitive.md`
- **FlatList Screen** — `docs/rules/rn/templates/screen-with-flatlist.md`
- **Zustand Store** — `docs/rules/rn/templates/zustand-store.md`
- **React Query Hook** — `docs/rules/rn/templates/react-query-hook.md`
- **Provider** — `docs/rules/rn/templates/provider.md`
- **Native Action Helper** — `docs/rules/rn/templates/native-action-helper.md`
- **推送通知 Bridge** — `docs/rules/rn/templates/push-notifications-bridge.md`
- **Navigation Helper** — `docs/rules/rn/templates/navigation-helper.md`
- **ErrorBoundary** — `docs/rules/rn/templates/error-boundary.md`
- **Logger（含 redaction）** — `docs/rules/rn/templates/logger.md`
- **Diagnostics Collector（本地日志 + 上传）** — `docs/rules/rn/templates/diagnostics-collector.md`
- **AppVersionGate（版本更新提示）** — `docs/rules/rn/templates/app-version-gate.md`
- **Safe URL** — `docs/rules/rn/templates/safe-url.md`
- **表单 Screen** — `docs/rules/rn/templates/form-screen.md`
- **i18n 初始化** — `docs/rules/rn/templates/i18n-setup.md`
- **架构测试** — `docs/rules/rn/templates/architecture-test.md`

## Quick Rules（高频违规）

- 对象 shape 默认使用 `interface I*`；`type` 仅用于 union / 派生 / function type 等别名场景；详细政策见 `docs/rules/rn/typescript.md`。
- 跨目录 import 必须使用 tsconfig path alias（`@components/*` / `@domain/*` 等）；同目录使用 `./xxx`。详见 `docs/rules/rn/typescript.md`。
- Expo Router 跳转不允许 `as Href` 字符串拼接；使用对象语法 `router.push({ pathname, params })`。详见 `docs/rules/rn/routing.md`。
- 业务代码不得直接 `import 'react-native-paper'`；必须使用 `@components/ui/*` wrapper。详见 `docs/rules/rn/ui-components.md`。
- 业务代码不得直接 `console.*`；走 `@api/logger`。详见 `docs/rules/rn/observability.md`。
- `expo-secure-store` / `@react-native-async-storage/async-storage` 只能在 `src/storage/*` 内 import。详见 `docs/rules/rn/storage.md`。
- 业务图片必须使用 `expo-image` 通过 `@components/ui/image` 接入，不直接用 RN `Image`。详见 `docs/rules/rn/images.md`。
- 网络状态只从 `@domain/network/network-store` 读取；业务代码不得直接 import `@react-native-community/netinfo`。
- 业务长列表必须 `FlatList` / `SectionList`，使用 `@components/ui/flat-list-performance` 常量；不允许 `.map` 直接渲染。详见 `docs/rules/rn/ui-components.md`。
- 用户可见文案必须走 i18n，不允许硬编码。详见 `docs/rules/rn/i18n.md`。
- 所有外部 URL 与 deep link 入口必须走 `@domain/safe-url` 校验；详见 `docs/rules/rn/security.md`。
