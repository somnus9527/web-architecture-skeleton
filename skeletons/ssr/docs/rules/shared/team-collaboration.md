# Team Collaboration

> 前后端共享规范:owner 声明、变更意图、review 路由。

## Ownership

每个模块 / app / package 必须有明确 owner。owner 未最终确定时,在 PR / Issue 中临时声明:

- **Business Owner**:确认业务规则
- **Tech Owner**:确认实现边界
- **Review Owner / Reviewer**:确认规范和测试
- **目标前端 app/package、BFF module、后端 module/package**,以及 **API 契约 owner**

## Intent To Change

任何代码或业务文档改动前,在 Issue / PR 描述写明:

- 目标模块 / app / package
- 改动意图
- 影响的 API / SQL / MQ / 缓存
- 需要同步的前端或后端文档

## Review Routing

**后端 / 跨端**:

- 业务规则变更:Business Owner + Tech Owner
- API 契约变更:后端 owner + 前端 owner
- SQL / 事务 / MQ 变更:Tech Owner + 架构师
- 规则文件变更:架构师

**前端**:

- SSR/BFF app:SSR owner + API owner(BFF 变更)
- SPA app:app owner + UI owner(可见流程变更)
- 共享 TypeScript 契约:后端 API owner + 前端 app owner
- 共享工具或配置:tooling owner

## Checklist

- [ ] 模块 / app / package 和 owner 已声明
- [ ] 影响面已列出
- [ ] 契约变更链接后端文档和 OpenAPI
- [ ] 验证命令已列出
- [ ] 相关文档同步、未绕过模块边界
- [ ] 已知缺口记入 Open Questions
