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
