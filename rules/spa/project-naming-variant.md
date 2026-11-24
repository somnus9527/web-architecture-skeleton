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

## Template Repository Binding

模板仓库默认按同级目录协作：

```text
<frontend-root>     = .
<backend-root>      = ../backend-architecture-skeleton
<delivery-doc-root> = <backend-root>
```

派生项目有配套后端时，初始化器将 `<backend-root>` 与 `<delivery-doc-root>` 绑定到
`--backend-root`。纯前端项目使用 `--no-backend`，生成：

```text
<backend-root>      = N/A
<delivery-doc-root> = .
```

配套后端必须使用其 `.agents/skills/initialize-backend-project/SKILL.md` 初始化，并通过
`--frontend-root` 反向绑定当前前端仓库。纯前端项目不创建空后端仓库，纯后端项目也不创建空前端
仓库。

父目录在每个人机器上可以不同，因此规则、文档、脚本和 handoff 中不得写个人绝对路径。

`spa-app`、`spa-app-web` 和 `SPA Application` 仅是骨架占位值。
