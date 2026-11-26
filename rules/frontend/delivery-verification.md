# Delivery Verification

> 本文只覆盖**前端交付**验收。后端文档、API 契约和数据变更的验收清单见
> [`../shared/module-documentation.md`](../shared/module-documentation.md)；后端规则属于配套后端仓库，
> 不在本骨架分发。

## Directory Constraints

- 前端代码放 `apps/<app-name>/`(monorepo)或用户指定目录。
- 开发文档输入只读:路径按 [`../shared/project-naming.md`](../shared/project-naming.md) 绑定的
  `<delivery-doc-root>` 和 `<backend-root>` 解析;不要猜测仓库名或绝对路径。
- 新项目 mock 数据放 Prism examples（`{{mockDir}}/examples/`，相对单 app 根或所属 app 根）；小型单文件契约可以把 example 内联在 `openapi.yaml`，但不得把 example 写回运行时 `src/mocks/mock-data.ts`。
- Prism 契约:新单 app 在项目根 `{{mockDir}}/`,monorepo 在 `apps/<app-name>/{{mockDir}}/`。真实 API 切换逻辑在 app-local `src/shared/tools/api-client.ts`,除非能力明确提升到 `packages/tools`。
- DTO 在 `src/types/dto/`、locale 在 `src/locale/`;跨 app DTO 进 `packages/types`,app-private DTO 留在所属 app。
- 不生成无关模板文档、空目录或不可用占位文件。

## Verification Checklist(前端)

验收要点(逐项 OK 或标注差异):

- 依赖已安装;typecheck 或 build 通过。
- **Ant Design / Modal/Drawer/message** 行为(`ConfigProvider` + `App` 包裹、浮层而非页内伪 modal、反馈通过 `App.useApp()`、新项目 antd-first、旧复杂界面保留已批准视觉或标注 parity-safe)按 [`./frontend-react.md`](./frontend-react.md)(SSR 的 UI 运行时细则由 SSR 变体补段承载)验收,本文不重复。
- 表单校验错误显示在对应表单控件下方;路由可达;核心交互可用:filter/search、create/edit、detail、status action、confirmation、error、empty、loading。
- 所有请求走 app-local `src/shared/tools/api-client.ts`、明确提升的 `packages/tools` 请求工厂,或已批准的请求封装;domain fetch hook 至少暴露 `data`/`loading`/`error`。
- **mock / Prism / OpenAPI / `{ data, code, codeMsg }` 包**(Prism 读 `{{mockDir}}/openapi.yaml`、example 用 `$ref` 拆分、每个运行时 service 方法映射 OpenAPI path+operationId、mock 返回字段与 OpenAPI/API 文档一致、缺包裹时 API client 报 contract error、`Planned`/未实现端点显式标注、schema 足以捕获 DTO 漂移)按 [`./mock-and-integration.md`](./mock-and-integration.md) 与 [`./api-contracts.md`](./api-contracts.md) 验收,本文不重复。
- **i18n / 硬编码文案**(`zh-CN` 与 `en-US` 存在且 key order 对齐、用户可见文案全部 locale-backed、fallback `codeMsg`/校验/Snackbar/空/错/aria/placeholder/mock 展示文案均走 locale,品牌/协议名/日志/注释/测试除外)按 [`./i18n.md`](./i18n.md) 验收,本文不重复。
- **环境、base URL 与认证传输**:`.env.mock/.dev/.test/.prod` 契约明确;mock=>real base URL 与确认的
  token 或 cookie/session 路径在真实联调交付时已记录或实现。变体专属的认证链路见补段。
- PM 专属 check 与生产构建在脚本存在时通过(如 `pnpm check`、`pnpm build:prod`);依赖/typecheck/lint/format/OpenAPI-mock/build/dev-mock 失败都是全量交付的 blocker。
- 启动策略:用户要启动时先看脚本;有 Prism/OpenAPI mock 且有 `dev:mock` 则用 `dev:mock`,否则用 `dev`/`dev:dev`;启动后若有多环境配置和匹配命令(`dev:mock`/`dev:dev`/`dev:test` 或 `--mode <env>`),报告环境=>命令映射和实际启动的环境。
- 进程清理:代理为验证或调试启动的 dev/mock/server/browser/Playwright 等长驻进程,必须在任务结束前关闭;若复用了任务开始前已经存在的用户进程,不得擅自终止,最终交付需说明复用情况。
- UI 文案不在常见桌面/移动宽度溢出。
- 若前端 UI/UE/UX 因 `ui-ux-pro-max` 不可用而降级,最终 handoff 提示用户按其标准流程安装 UI UX Pro MAX(不附安装说明)。

> 前端 service 的 module ID、错误码/`codeMsg`、状态转换和适用的数据对象需与后端文档、API
> 契约、migration、mock 和 TS 类型一致;不适用项明确 `N/A`。

## Final Handoff

最终回答应包含:现在能用什么;前端相对路径与 run/build 命令;后端与交付文档相对路径;API 契约、
mock 数据与 service 路径;适用的数据变更路径;模块清单及数据影响;已跑的验证命令与结果;重要假设;
建议的下一步后端集成。

非用户主动询问时,不要暴露实现琐碎细节。

## Execution Boundaries

- 规则不清时做产品向假设并标注,不停在问题清单。
- 业务需求描述默认全量交付:完整前端代码、mock、后端 docs、API 契约、SQL、验证与 handoff 说明。
- 用户明确只要 plan/docs/API/SQL 或其他部分产物时,不造无关产物,并说明有意跳过了什么。
- 不把 mock 当最终后端实现;不在前端页面暴露 secrets/真实 token/数据库连接/生产 API 地址。
- 不生成 Java 后端实现源文件,除非用户明确改变约束;不忽略用户给的表模型,冲突时解释风险并选兼容方案。
