# RN Rules

迁移自原 RN 规则库，规则与代码模板同层存放：模板被规则大量引用，必须随项目一起交付。

## 规则

| 文件                                             | 主题                   |
| ------------------------------------------------ | ---------------------- |
| [accessibility.md](./accessibility.md)           | 可访问性规则           |
| [api.md](./api.md)                               | API 与契约规则         |
| [app-version-update.md](./app-version-update.md) | 应用版本更新规则       |
| [architecture.md](./architecture.md)             | 架构规则               |
| [comments.md](./comments.md)                     | 注释规则               |
| [dependencies.md](./dependencies.md)             | 依赖与升级规则         |
| [diagnostics.md](./diagnostics.md)               | 本地诊断与日志上传规则 |
| [error-handling.md](./error-handling.md)         | 错误处理规则           |
| [forms-keyboard.md](./forms-keyboard.md)         | 键盘与表单规则         |
| [frontend.md](./frontend.md)                     | 组件拆分规则           |
| [i18n.md](./i18n.md)                             | 国际化规则             |
| [images.md](./images.md)                         | 图片规则               |
| [naming.md](./naming.md)                         | 文件与符号命名规则     |
| [native-actions.md](./native-actions.md)         | Native 动作规则        |
| [network-offline.md](./network-offline.md)       | 网络状态与离线规则     |
| [observability.md](./observability.md)           | 可观测性规则           |
| [performance.md](./performance.md)               | 性能与渲染规则         |
| [push-notifications.md](./push-notifications.md) | 推送通知规则           |
| [release.md](./release.md)                       | 发布与运行时配置规则   |
| [routing.md](./routing.md)                       | 路由与导航规则         |
| [security.md](./security.md)                     | 安全规则               |
| [startup.md](./startup.md)                       | 启动 Discipline 规则   |
| [state-management.md](./state-management.md)     | 状态管理规则           |
| [storage.md](./storage.md)                       | 存储规则               |
| [testing.md](./testing.md)                       | 测试与 CI 规则         |
| [theme.md](./theme.md)                           | 主题与样式规则         |
| [todo-workflow.md](./todo-workflow.md)           | Todo 工作流规则        |
| [typescript.md](./typescript.md)                 | TypeScript 规则        |
| [ui-components.md](./ui-components.md)           | UI 组件规则            |
| [webview.md](./webview.md)                       | WebView 规则           |

## 代码模板

| 文件                                                                     | 主题                       |
| ------------------------------------------------------------------------ | -------------------------- |
| [api-client.md](./templates/api-client.md)                               | API Client 模版            |
| [app-version-gate.md](./templates/app-version-gate.md)                   | AppVersionGate 模版        |
| [architecture-test.md](./templates/architecture-test.md)                 | 架构测试模版               |
| [diagnostics-collector.md](./templates/diagnostics-collector.md)         | Diagnostics Collector 模版 |
| [endpoint-wrapper.md](./templates/endpoint-wrapper.md)                   | Endpoint Wrapper Template  |
| [error-boundary.md](./templates/error-boundary.md)                       | ErrorBoundary 模版         |
| [form-screen.md](./templates/form-screen.md)                             | 表单 Screen 模版           |
| [i18n-setup.md](./templates/i18n-setup.md)                               | i18n Setup 模版            |
| [logger.md](./templates/logger.md)                                       | Logger 模版                |
| [native-action-helper.md](./templates/native-action-helper.md)           | Native Action Helper 模版  |
| [navigation-helper.md](./templates/navigation-helper.md)                 | Navigation Helper Template |
| [provider.md](./templates/provider.md)                                   | Provider 模版              |
| [push-notifications-bridge.md](./templates/push-notifications-bridge.md) | 推送通知 Bridge 模版       |
| [react-query-hook.md](./templates/react-query-hook.md)                   | React Query Hook Template  |
| [safe-url.md](./templates/safe-url.md)                                   | Safe URL 模版              |
| [screen-with-flatlist.md](./templates/screen-with-flatlist.md)           | FlatList Screen Template   |
| [theme-tokens.md](./templates/theme-tokens.md)                           | Theme Tokens 模版          |
| [ui-primitive.md](./templates/ui-primitive.md)                           | UI Primitive 模版          |
| [zustand-store.md](./templates/zustand-store.md)                         | Zustand Store Template     |
