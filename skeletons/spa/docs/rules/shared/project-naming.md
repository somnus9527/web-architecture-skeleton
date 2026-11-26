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

## Project Naming（SPA 变体）

初始化器接收一个不带 `-web` 的小写 kebab-case 基础项目名，并要求明确后端关系：

- 配套后端：`--backend-root <relative-path>`
- 纯前端：`--no-backend`

| 变量           | 含义                    | 示例                 |
| -------------- | ----------------------- | -------------------- |
| `<project-id>` | 小写 kebab-case 项目 ID | `operations-console` |

输入已带 `-web` 时初始化器会移除末尾后缀，再按统一规则重新派生。

默认派生：

```text
frontend package = <project-id>-web
application title = <project-id>-web
base path        = /<project-id>/
static root      = /var/www/<project-id>
```

初始化时同步替换：

- package、应用标题和项目文档
- `VITE_APP_BASE_PATH`
- 浏览器版本 channel 与 sessionStorage key

Nginx location 按 base path 配置，API upstream 与正式域名由发布环境绑定。

## Placeholder Values

当前 SPA 骨架使用以下占位值，初始化时必须替换：

| Variable                  | Placeholder       |
| ------------------------- | ----------------- |
| `<project-name>`          | `SPA Application` |
| `<project-id>`            | `spa-app`         |
| `<frontend-package-name>` | `spa-app-web`     |

复制为正式应用后执行：

```bash
rg -n "spa-app|SPA Application" .
```

命中项必须全部替换或确认属于说明性文字。

## Template Repository Binding

模板仓库默认按同级目录协作，不在规范里写死具体仓库名：

```text
<frontend-root>     = .
<backend-root>      = 由 --backend-root 绑定
<delivery-doc-root> = <backend-root>
```

派生项目有配套后端时，初始化器将 `<backend-root>` 与 `<delivery-doc-root>` 绑定到
`--backend-root`。纯前端项目使用 `--no-backend`，生成：

```text
<backend-root>      = N/A
<delivery-doc-root> = .
```

配套后端必须使用其仓库自带的初始化技能完成绑定，不得从当前前端仓库引用后端文件。纯前端项目不创建
空后端仓库，纯后端项目也不创建空前端仓库。

父目录在每个人机器上可以不同，因此规则、文档、脚本和 handoff 中不得写个人绝对路径。
