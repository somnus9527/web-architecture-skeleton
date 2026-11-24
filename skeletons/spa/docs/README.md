# SPA Skeleton Documentation

## 目录

| 目录                                   | 内容                                       |
| -------------------------------------- | ------------------------------------------ |
| [`rules/`](./rules/)                   | React SPA 编码、架构、环境、发布和协作规范 |
| [`initialization/`](./initialization/) | 复制骨架后的初始化清单                     |
| [`deployment/`](./deployment/)         | 构建发布与 Nginx 交接                      |
| [`decisions/`](./decisions/)           | 项目基线与后续 ADR                         |

业务文档、真实 API 契约、领域模型和后端规范不随骨架预置。新项目确认业务范围后再按实际需要建立，
不要把示例工作台模型当成业务事实源。

骨架自带的 [`../mocks/openapi.yaml`](../mocks/openapi.yaml) 里只有演示接口（含 `/workspace/*`、`/auth/*`），
它们不是业务契约，因此骨架内不建立 `docs/api/**` 文档条目，契约文件已在 `info.description` 中标注。
派生项目按 [`rules/frontend/api-contracts.md`](./rules/frontend/api-contracts.md) 以确认后的契约替换这些
路径与 `operationId`，再建立 `docs/api/<module>.md`。

## 入口

- 项目说明：[`../README.md`](../README.md)
- AI 协作：[`../AGENTS.md`](../AGENTS.md)
- 项目命名：[`rules/shared/project-naming.md`](./rules/shared/project-naming.md)
- SPA 初始化：[`initialization/spa-app-initialization.md`](./initialization/spa-app-initialization.md)
- 线上发布：[`deployment/online-release.md`](./deployment/online-release.md)
