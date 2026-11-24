# Project Rule Capture

> 前后端共享规范:项目规则的状态生命周期 + 变更流程。派生项目规则只沉淀**已反复出现、影响一致性
> 或安全性**的项目特定决策;通用共享、React SPA / SSR、tooling 和 Java 后端分层指引留在各自通用规则
> 文件,项目名、仓库相对路径与 app/package 绑定放
> [`./project-naming.md`](./project-naming.md) 或项目 ADR。

## Lifecycle

| Status     | Meaning                            |
| ---------- | ---------------------------------- |
| Proposed   | 讨论中,不能作为硬门禁              |
| Accepted   | 团队已采用,AI 和 reviewer 必须遵守 |
| Deprecated | 不再推荐,保留历史                  |
| Superseded | 被新规则替代                       |

## Change Process

- 新增规则必须说明:触发场景、约束内容、反例、验证清单。
- 修改规则必须说明原因,并检查 AGENTS / README 是否同步。
- 废弃规则不直接删除,先标 `Deprecated` + 替代方案;讨论稿标 `Draft` 暂存,不放进硬规则索引。
- `shared/**`、`frontend/**`、`backend/**` 的通用规则由本模板维护;目标仓库只记录项目绑定、已批准
  例外和更强的本地约束。
- 通用规则变更后做断链检查,同步两个模板的 AGENTS routing、README、初始化/复用清单和验证入口。
- 后端模板的 Git Hook、AI Hook、Maven/ArchUnit/ErrorProne/Spotless 与 CI 是规则的可执行承载;不得只改
  Markdown 而遗漏对应门禁。
