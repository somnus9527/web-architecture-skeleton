# Intake And Delivery

> 前后端共享规范:需求进场拆解 + 交付纪律。

## Repository Bindings

交付前先在项目命名文档中绑定相对路径:

- `<frontend-root>`:前端仓库或所属 app 根目录。
- `<backend-root>`:后端仓库根目录;无后端时标 `N/A`。
- `<delivery-doc-root>`:产品、领域、API、use case 和 task 文档事实源;配套项目默认使用后端仓库。

模板默认是 `<frontend-root>=.`、`<backend-root>=../backend-architecture-skeleton`、
`<delivery-doc-root>=<backend-root>`。派生后仓库名或目录关系变化时必须更新为实际相对路径,不得写
个人机器绝对路径。

## Business Brief Shape

写代码或文档前,先把用户描述转成这些字段:Audience(谁用、多频繁)、Job(支持的决策/操作/审批/报表/执行任务)、Objects(业务实体)、States(draft/pending/submitted/approved/rejected/fulfilled/overdue/completed/archived 等)、Actions(create/edit/assign/approve/submit/sync/export/retry/compensate 等)、Signals(指标/新鲜度/异常/SLA/风险/优先级/owner/审计/下一步)、Constraints(品牌/设备/语言/auth/租户/数据源/外部系统/截止/必备页面)。

用户已给足够上下文做出有用初版时,不要索要完整 PRD;做合理假设并在交付后列出。

## Seven Lanes(文档产出纪律)

需求进入开发前,必须按 7 条线拆清楚,每条都有产出或明确"不适用":

| Lane                   | Output                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Product(业务真相,只读) | `<delivery-doc-root>/docs/product/<module>/<module>-business.md` + `story/<name>-story.md`                                     |
| Domain(+ catalogs)     | `<delivery-doc-root>/docs/domain/<module>/<module>-domain.md`                                                                  |
| API(story 级)          | `<delivery-doc-root>/docs/api/<module>/story/<name>-api.md` + `<frontend-root>/mock/openapi.yaml`(如使用 OpenAPI/Prism) |
| Usecase(跨模块时)      | `<delivery-doc-root>/docs/usecases/<module>.md`                                                                                |
| Task                   | `<delivery-doc-root>/docs/tasks/{backend,frontend}/<module>/<name>-task.md` + `acceptance.md`                                  |
| SQL                    | `<backend-root>/sql/ddl/<module>.sql`(使用关系型数据库且有 DDL 变更时)                                                         |
| Verification           | 目标仓库内的测试/门禁命令、验收点、风险清单和执行证据                                                                          |

## Delivery Surfaces(每个模块内的交付面)

在 7 lanes 之上,每个模块的具体交付拆成这些面:

- Frontend interaction: pages, routes, components, forms, tables, filters, details, state actions, confirmations,
  feedback, loading, empty, and error states.
- Backend capability: module boundary, domain rules, validation, transactions, idempotency, state machine, external
  adapters, logs, observability, permissions, and only the middleware capabilities actually required.
- API contract: resource paths, methods, request/response DTOs, pagination, sorting, filtering, error codes, auth, examples, and state transition rules.
- Data model: authoritative store, tables/collections, fields, indexes, unique constraints, audit fields, deletion
  policy, enum comments, initialization data, and migration changes when applicable.
- Mock and handoff: local mock data, mock services, real API replacement notes, assumptions, run commands, build commands, and remaining integration work.

## Module Split

按业务能力(不是技术分层)识别模块。好的模块名是具体名词或工作流:`payment-order`(付款单创建/审核/状态/明细/附件)、`approval-flow`(审批提交/回调/状态同步/拒绝)、`customer-account`(客户档案/账户校验/状态/风险)、`file-management`(上传元数据/附件绑定/查找)、`config-dict`(字典与可配置项维护)。

> 每个模块要记录的标识字段(Module ID/中文名/Owner/Related/Tables Used + 访问模式/SQL File/Frontend Surfaces 等)的权威定义见 [`./module-documentation.md`](./module-documentation.md),本文不重复。

## Question Policy

仅当下列之一阻塞时,问一个简洁澄清:目标用户或核心工作流未知;app 类型在 dashboard/表单/审批/CRM/报表/公开站点间歧义;集成需要凭据/API 契约/生产 URL/不可逆生产行为;数据库模型冲突会改变核心业务含义;破坏性编辑会覆盖用户成果。

否则按已绑定模板推进:app 语言跟随用户语言;前端在拿到真实后端契约前可使用项目已有的
Prism/OpenAPI mock;技术栈、设备范围、认证方式、数据存储和中间件以目标仓库规则及已确认契约为准,
共享规则不替项目作固定选型。

## Delivery Planning

先根据用户范围和已确认的 Task Package 确定交付面。全栈需求通常包含可运行前端、与 API 文档对齐
的 mock、后端实现或后端 task、API 契约、所需数据变更和 mock-to-real handoff;前端-only、
后端-only、文档-only 任务只交付其适用部分。

用户明确说"先出方案""只写文档""只要接口""只要 SQL""不要前端""不要写代码"等时,只产出请求的产物,并说明哪些全量产物被有意跳过。

## Iteration Mapping

改动请求映射到要同步更新的产物(简表):

- "指标不对" => metric 定义 / labels / 样例值 / API 字段 / mock / SQL 字段语义。
- "流程是另一个顺序" => workflow stages / 状态转换 / action labels / API state-change 文档 / mock 行为。
- "给销售/运营/财务用" => 导航 / 实体名 / KPI 层级 / 表列 / 后端模块语言 / 权限。
- "要能筛选/搜索" => 受控 UI state / service query params / mock filtering / API query 文档 / empty state / SQL 索引。
- "换个风格" => 先改 tokens 和 composition,不要逐组件重绘。
- "接接口" => 保留 service 方法名,集中替换 mock 实现,处理 loading/error/empty/stale/partial。

## Rules

- 业务事实未确认时,不得把自然语言猜测直接固化为代码、API、SQL、状态或权限。
- 业务规则先落 Product/Domain 事实源,再落 API、数据变更和代码。
- API 变更必须同步前端 OpenAPI mock。
- 未确认的问题写入 Open Questions,不要猜。

## Checklist

- [ ] 7 lanes 都有输出或明确说明不适用
- [ ] Open Questions 已列出
- [ ] API / SQL / MQ / 缓存影响已记录
- [ ] 验证命令和预期结果已记录
