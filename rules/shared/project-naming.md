# Project Naming

本文定义新应用复制骨架后的项目身份、目录关系与交付文档根。初始化器接收一个不带 `-web` 的小写
kebab-case 基础项目名，并要求明确是否有配套后端仓库（`--backend-root` 或 `--no-backend`）。

初始化参数与占位值按变体不同，见文末补段。

## Initialization Input

| Variable       | Meaning                    | Example            |
| -------------- | -------------------------- | ------------------ |
| `<project-id>` | 小写 kebab-case 基础项目名 | `supply-lifecycle` |

输入已带 `-web` 时初始化器会移除末尾后缀，再按统一规则重新派生，避免生成 `-web-web`。

## Placeholder Binding

当前骨架为了保持可运行，使用一组占位值。各变体的占位值、派生清单和 grep 命令见文末补段；复制为
正式应用后，第一步必须替换并确认。

| Variable              | Meaning                          |
| --------------------- | -------------------------------- |
| `<frontend-root>`     | 前端仓库根目录                   |
| `<backend-root>`      | 配套后端仓库根目录；没有则为 N/A |
| `<delivery-doc-root>` | 交付文档根目录                   |

没有配套、由当前项目维护的后端仓库时，初始化器将 `<backend-root>` 绑定为 `N/A`，
`<delivery-doc-root>` 绑定为当前仓库 `.`。这不影响前端自身 BFF 或已确认的外部 API。

## Initialization Checklist

- [ ] `<project-id>` 已由使用者提供
- [ ] 已通过 `--backend-root` 或 `--no-backend` 明确配套后端关系
- [ ] `<frontend-root>`、`<backend-root>`、`<delivery-doc-root>` 已绑定
- [ ] README、AGENTS 与项目绑定文档已同步
- [ ] 骨架占位值已按变体补段清理

## Hard Rules

- 规范正文不得写入具体域名、token、cookie value、后端凭证或部署账号。
- 配套仓库和文档根只记录相对路径，不得写个人机器绝对路径。
- 文档中的文件引用只能指向当前仓库内存在的文件；跨仓库内容直接复制或改为文字说明。
