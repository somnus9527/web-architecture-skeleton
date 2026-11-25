# Module Documentation

> 前后端共享规范:按业务模块组织文档 + 文档一致性 + AI 可读的写作风格。

本文使用 [`./project-naming.md`](./project-naming.md) 中绑定的 `<frontend-root>`、`<backend-root>` 和
`<delivery-doc-root>`。所有跨仓路径都使用相对路径。

## Required Documents

一个业务模块进入实现前,至少需要:

- `<delivery-doc-root>/docs/product/<module>/<module>-business.md`(业务真相,只读)+
  `story/<name>-story.md`
- `<delivery-doc-root>/docs/domain/<module>/<module>-domain.md`(开发基座 + catalogs,单一事实源)
- `<delivery-doc-root>/docs/api/<module>/story/<name>-api.md`(子模块契约)
- `<delivery-doc-root>/docs/tasks/{backend,frontend}/<module>/<name>-task.md`(+ `acceptance.md`)
- `<backend-root>/sql/ddl/<module>.sql`(使用关系型数据库且有表结构变更时)

跨模块编排时加 `<delivery-doc-root>/docs/usecases/<module>.md`。

## Consistency Rules

- business / domain 是业务事实来源。
- api 描述对外契约;使用 OpenAPI/Prism 时必须能映射到所属前端根的 `{{mockDir}}/openapi.yaml`。
- backend task 描述技术实现,**不得新增业务规则**。
- 数据表/集合、字段和索引必须能追溯到 domain / backend task;不涉及持久化时明确 `N/A`。

## Module-First Rule

先按业务模块拆分,再写细节。一个模块映射一个内聚的业务能力(付款单、审批、客户账户、文件管理、对账、通知、配置等)。不要把不相关模块塞进一份大文档;跨模块工作流在"归属模块"里记录,并显式列出跨模块依赖。

## Module Identification

在 backend task 与 api 文档顶部都定义这些字段:

| Field             | Meaning                                   |
| ----------------- | ----------------------------------------- |
| Module ID         | 稳定小写 id,如 `<module-id>`              |
| Module Name       | 中文业务名                                |
| Business Owner    | 用户角色或业务团队                        |
| Primary Objects   | 模块处理的核心实体                        |
| Related Modules   | 上下游模块                                |
| Data Change       | SQL/migration 文件相对路径或 `N/A`        |
| Data Stores Used  | 明确的表/集合/索引清单 + 读写用途或 `N/A` |
| Frontend Surfaces | 页面、路由、对话框或 service 方法         |

## Table Usage Marking

涉及持久化的模块文档必须含数据使用矩阵,使用实际表/集合/索引名。逻辑删除字段和存储语义以目标
后端仓库的数据模型及其适用规则为准:

```markdown
## Table Usage

| Data Object      | Alias | Access | Purpose      | Key Fields              | Migration Source     |
| ---------------- | ----- | ------ | ------------ | ----------------------- | -------------------- |
| `<primary_data>` | `pd`  | R/W    | 模块主记录   | id, business_no, status | sql/ddl/<module>.sql |
| `<related_data>` | `rd`  | R      | 关联信息查询 | relate_no, resource_url | sql/ddl/<module>.sql |
```

Access:`R` 只读 / `W` 只写 / `R/W` 读写 / `Ref` 引用校验或展示但不直接改。每个 service 方法和
endpoint 列出相关数据对象;不适用时标 `N/A`,让下游 AI 不必猜测隐含依赖。

## AI-Readable Style

文档同时面向未来的 AI 开发者,核心约束:

- 规则/流程/端点/错误/用例用稳定 ID(`BR-PAY-001`、`FLOW-PAY-002`、`API-PAY-003`、`ERR-PAY-004`);假设标 `ASSUMPTION-<MODULE>-<n>`,遗留问题标 `OPEN-<MODULE>-<n>`。
- 规则、字段、状态转换、校验、映射优先用表格;短陈述句,不把需求藏在长段落里;显式标注输入/输出/前置/后置/副作用。
- 按 ID 交叉引用:endpoint => service method => business rule => data store => migration file。处于产品或开发
  文档产出阶段时,业务算法使用伪流程或有序步骤,不在规则文档中生成 Java 源码;进入已确认的实现任务后
  按目标后端规则开发。

## Downstream Skill Recommendations

生成的文档是后续开发 skill 的实现基线;每份模块文档应自包含,让另一个 skill 无需回看原始对话就能理解业务与技术意图。用推荐级别让下游自行决策:

| Level | Meaning                                         | Downstream Handling                  |
| ----- | ----------------------------------------------- | ------------------------------------ |
| S1    | 强烈推荐;改动影响业务正确性/数据一致性/集成兼容 | 通常遵守;若改,记录原因并更新相关文档 |
| S2    | 推荐主流实现;项目约定不冲突时的良好默认         | 遵守或按项目约定调整                 |
| S3    | 可选优化或未来增强                              | 时间/范围/需求允许时再做             |
| N/A   | 本模块不建议                                    | 除非新需求,跳过                      |

每份 backend 文档应含 "Downstream Skill Handoff" 段:先读文件清单;建议的实现归属(模块边界/包建议/要建的类/无关文件);建议的依赖决策(上下游模块、外部系统、缓存键、MQ topic、定时任务、表归属 + S1/S2/S3/N/A);建议实现顺序(SQL => DTO/entity/enum => mapper/repo => domain service => application service => controller/API => 异步消费/job => 测试);建议验证(单测/集成/API 示例/SQL 自检/手工场景);遗留问题与假设。

下游 skill 可按项目需要调整类名、中间件选型、缓存策略、MQ topic、实现顺序、验证范围;**不得静默改动**业务规则、表名、状态值、响应包、错误码、权限语义——确需改动时更新文档或明确标注偏差。

## Business Logic Completeness

模块文档建议覆盖:Actors 与权限;主用例与备选/异常流;请求/响应/实体/数据字段语义;完整校验规则;
状态机与非法转换错误;事务、幂等和并发设计;数据访问规则;外部系统、缓存、事件、定时、文件和通知
等适用能力或 `N/A`;审计、日志、指标与追踪;错误码和前端展示行为。不得为满足清单而引入未使用的
数据库、缓存、MQ、搜索或任务调度能力。

## Traceability

每份 backend task 末尾加可追溯矩阵(多个 endpoint、规则或数据对象时必填):

```markdown
## Traceability

| Requirement/Rule ID | API ID        | Service Method           | Data Objects     | Frontend Surface | Test Scenario |
| ------------------- | ------------- | ------------------------ | ---------------- | ---------------- | ------------- |
| BR-MODULE-01        | API-MODULE-01 | ModuleAppService.execute | `<primary_data>` | ModulePage       | 正常执行用例  |
```

## Engineering Baseline

Java 后端实现遵循配套后端仓库的路由约定与本地门禁。数据库、
缓存、MQ、搜索、定时任务和认证模型以确认的项目绑定为准;共享文档只要求明确适用性、一致性、
失败行为和验证证据,不强制所有项目采用同一组中间件。

## Checklist

- [ ] 文档模块名一致
- [ ] 状态机 / 枚举 / 错误码一致
- [ ] API endpoint 和 OpenAPI operationId 一致
- [ ] SQL 表影响矩阵已写
- [ ] MQ / 缓存 / 定时任务影响已写
- [ ] 关键模块(>1 endpoint 或 >1 表)有 Traceability 矩阵
