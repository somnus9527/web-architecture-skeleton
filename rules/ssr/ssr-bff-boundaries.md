# SSR BFF Boundaries

## BFF Goals

- BFF 是 Next SSR 应用到远程后端或 Prism mock 的唯一服务端业务出口。
- BFF 隔离后端 DTO、统一响应 wrapper、错误结构、鉴权 header、request id、缓存策略和 mock/真实服务切换。
- BFF 输出前端稳定 view model，页面和组件不依赖后端字段名、Java envelope、数据库字段或 Prism example 的临时形状。
- 本骨架固定 BFF-only：`src/bff/` 不承接数据库、Redis、MQ、邮件、供应商同步、支付轮询、库存履约、
  定时任务或后台 worker；这些能力属于配套后端或另行批准的服务端架构。

## Directory Responsibilities

```text
src/bff/
  gateway/      # 唯一真实出站请求层
  services/     # 业务能力编排
  adapter/      # 后端 DTO -> 前端 view model
  routes/       # Route Handler facade
  actions/      # Server Action facade
  dto/          # app-local BFF DTO；复用 DTO 按目标项目契约目录放置
  shared/       # BFF-only pure helper
  transform/    # headers、session、request context 转换
```

- `gateway`：按 endpoint contract 选择 method/path/baseUrl/cache/timeout，注入 request id、authorization、locale、tenant 等 headers，校验 response wrapper 并脱敏错误。
- `services`：组合单个业务用例，调用 gateway，处理业务缺省、状态转换、幂等和跨 endpoint 编排；每个上游调用必须标注 `required`、`degradable` 或 `optional`。
- `adapter`：只负责 DTO 到 view model 的映射、字段兼容、枚举归一、展示模型稳定化；不发请求，不读 cookies，不写缓存。
- `routes`：给 Route Handler 使用的 facade，负责 request/query/body/cookie/header 到 service input 的转换。
- `actions`：给 Server Action 使用的 facade，负责 formData/typed input 到 service input 的转换和 revalidation plan。
- `shared`：只放 BFF 内部纯函数，例如 request id、cookie 解析、稳定 JSON response、脱敏 logger、会话轻量模型转换。

**总原则(按层职责组织,不靠文件名分层)**:`src/bff/` 下**只允许**出现上表的 canonical 层目录(`gateway/ services/ adapter/ routes/ actions/ dto/ shared/ transform/`)。**禁止**新建业务语义子目录(如 `bff/user/`、`bff/order/`)再在其中用文件名后缀(`user-auth-gateway.ts`、`user-auth-service.ts`)模拟分层——这等于用文件名重新发明一套与层目录平行的边界,绕过了上表的职责隔离。每个文件**按其层归属**落到对应目录:`*-gateway.ts` 必须在 `gateway/`、`*-service.ts` 在 `services/`、`*-adapter.ts` 在 `adapter/`、依此类推;业务维度通过**文件名前缀**(`user-auth-*`)表达,而不是通过目录。

本骨架固定 BFF-only，不提供本地后端模式。需要在同一应用内承载领域、数据库或中间件时，属于另立的服务端架构决策，必须单独审批并定义模块、依赖、部署与门禁；不得把数据库、MQ、worker 或完整领域实现直接塞入 `src/bff/`。

## Forbidden BFF Layouts

**铁律**:`src/bff/` 的分层只由 canonical 层目录承载,不得用业务文件夹或文件名后缀替代。

| 错误位置                                                        | 反模式                                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/bff/<business>/...`(如 `bff/user/user-auth-gateway.ts`)    | 用业务文件夹 + 文件名后缀模拟分层,绕过层目录边界;同一业务的 gateway/service/adapter/routes 被错误地聚到一个业务目录里 |
| `src/bff/gateway/<business>/...` 等层目录内再按业务建子目录     | 层目录内应平铺;业务维度用文件名前缀表达,不再嵌业务子树(跨项目复用 DTO 按目标项目契约目录放置除外)                     |
| 空的 canonical 层目录长期只留 `.gitkeep`,真实代码却在业务文件夹 | 层骨架形同虚设;新增能力应直接落到对应层目录                                                                           |

迁移已有违规:`git mv` 文件到对应层目录(`bff/user/user-auth-gateway.ts` → `bff/gateway/user-auth-gateway.ts`,service/adapter/routes 同理),把混在一起的类型按 DTO / view model / 内部 envelope 拆到 `dto/` 与 `shared/`,并同步改所有调用方 import 路径。

## Forbidden Action Locations

> 本节是上面"按层职责组织"总原则在 `actions` 层上的具体实例;同样的"落到对应层目录、平铺、可被 grep 穷举"要求适用于 `gateway/ services/ adapter/ routes/` 等所有层。

**铁律**:所有 Server Action 入口文件**必须**落在 `src/bff/actions/`,平铺布局(不分子目录),命名 `<action>-action.ts` 或 `<action>Action.ts`(沿用既有项目大小写约定)。

**禁止位置**(即使内部通过 `@/bff/services/` 调 BFF,文件位置本身也违反 4 层边界):

| 错误位置                                       | 反模式                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/actions/<x>.ts` 顶级                      | 与 `src/bff/actions/` 同义重复,语义混乱                                                                  |
| `src/features/<module>/actions/<x>.ts`         | 让 features 子树"看起来"可以自发 server action;浏览器=>后端的可调点必须可被 `grep src/bff/actions/` 穷举 |
| `src/app/**/actions/<x>.ts`(App Router 子树内) | App Router 子树只放 `page.tsx` / `layout.tsx` / `route.ts`,Server Action 文件不属于此处                  |

迁移已有违规:`git mv` 文件到 `src/bff/actions/`,同步改所有调用方 import 路径(从相对路径或 `@/features/<x>/actions/...` 改为 `@/bff/actions/...`)。

## Import Direction

- `src/app/**/route.ts` 只导入 `src/bff/routes/**` 或极少量同目录参数 helper。
- Server Action 入口只导入 `src/bff/actions/**` 或 `src/bff/services/**` 中已声明可供 action 使用的能力。
- Server Component 可以导入 `src/bff/services/**` 的 read 能力；若项目要求更严格，应统一经 `src/bff/routes/**` 或 server facade。
- `src/features/**` 和 Client Component 不导入 `src/bff/**`，除非目标项目明确提供浏览器安全的 BFF client wrapper。
- `src/bff/services/**` 可以导入 `gateway`、`adapter`、`dto`、`shared`；不能导入 `src/app/**` 或 Client Component。
- `src/bff/gateway/**` 不导入 UI、React component、route handler 或 adapter；它只关心契约、请求、响应和错误。

## Route Handler Rules

- 允许：读取 `Request`、headers、cookies、query、path params、body；生成 request id；读取轻量会话；调用 BFF route facade；返回稳定 JSON、status 和 cache header。
- 禁止：导入 DB/Redis/MQ/供应商 SDK/邮件 SDK/旧 server lib ；直接请求后端 base URL；直接请求 Prism；返回后端 raw DTO；实现长业务流程或后台任务。
- 迁移旧 Route Handler 时，只搬迁当前入口真正需要的纯 helper；不要一次性把旧 server 目录搬进 `shared`。
- 仍有基础设施副作用的旧代码不能进入 BFF shared，只能由后端接口、专门迁移任务或受控 legacy 缺口承接。

## Gateway Rules

- gateway 必须从 endpoint id 或 contract 获取 method/path/cache/auth 配置，不在 service 中散落 URL 字符串。
- gateway 负责 baseUrl 选择：mock/dev/test/prod 通过环境配置切换，不在页面、组件或 service 中判断目标域名。
- gateway 注入 `X-Trace-Id` 或项目等价 trace header；若上游请求已有 trace id，优先透传。`X-Request-Id` 作为兼容别名允许，但新代码统一用 `X-Trace-Id`。
- gateway 做 timeout、HTTP non-2xx、业务 code、malformed wrapper、网络错误和 JSON parse 错误的归一化。
- gateway 错误对象不得包含 token、cookie、密码、完整邮箱/手机号、后端堆栈或供应商敏感响应。
- gateway 可以实现请求级 dedupe 或框架 fetch cache，但必须尊重用户态、租户态、语言、币种和权限维度。
- gateway 必须记录每次上游调用的 endpoint id、method、path、duration、status、业务 code 和 request id；日志中不得输出完整 token、cookie 或敏感 payload。
- 统一 logger、日志 schema、transport、级别、trace 透传、脱敏、生产 client console、PM2、审计事件和 Web Vitals 按 [`./ssr-observability-and-logging.md`](./ssr-observability-and-logging.md) 执行。

## Degradation And Observability

- `required` 上游失败时当前 BFF 能力失败，返回稳定错误 wrapper 和 request id。
- `degradable` 上游失败时返回业务认可的兜底值，并记录降级原因、endpoint id 和 request id。
- `optional` 上游失败时可以省略对应字段，但 adapter 输出的 view model 必须保持结构稳定或明确字段可选。
- 可降级和可缺省调用必须局部 `try-catch`，不能让单个非必需上游拖垮整个 BFF response。
- Route Handler 和 Server Action 必须输出入口日志、上游调用摘要和异常日志，且经统一 logger/context helper 输出结构化日志，不直接拼接非结构化字符串；具体字段 schema 见 [`./ssr-observability-and-logging.md`](./ssr-observability-and-logging.md)。
- BFF 默认性能预算：单次响应 P99 目标小于 500ms；单个 Route Handler 上游调用数不超过 5 个，超过时优先拆 endpoint、引入批量接口或调整页面数据岛。
- 非阻塞日志、审计和分析可以使用 Next `after()`；核心业务副作用、支付、订单状态推进、库存履约和必须成功的写操作不能放到 `after()`。

## Auth And Session

- 浏览器会话可以来自 cookies/headers，但后端契约使用 `authorization: <backend-token>` 或项目等价服务端 header。
- BFF 负责把 web/operator session 转换为后端 authorization header；token 不进入 Client Component props 或 JSON response。
- BFF 出站请求除 `authorization` 外，按后端契约要求注入服务端身份/上下文 header（典型组合：`X-User-Id`、`X-User-Type`、`X-Tenant-Id`、`X-Trace-Id`）；若后端从 Bearer token 自行解出用户身份且不依赖额外 header，则不外加 `X-User-*`，必须在 handoff 中说明所选方案。**严禁** 把浏览器 cookie 直接透传给后端作为身份凭证。
- 缺少会话返回稳定 401；权限不足返回稳定 403；不要把后端鉴权 raw error 直接透出。
- 登录、登出、刷新 token、清 cookie 等逻辑必须集中在 BFF route/action facade 或 BFF shared helper，不能散落在多个 Route Handler。

## Legacy And Backend Gap

- legacy catch-all 只能返回受控缺口状态和 request id，不能继续执行旧 DB/Redis/MQ/供应商逻辑。
- `backend-gap` 只能标注契约和实现缺口；mock 环境仍应提供旧业务验收所需的默认成功 example。
- 当后端缺口影响真实环境时，在 handoff 中标注能力状态、阻塞点、降级行为和后续后端接口需求。
