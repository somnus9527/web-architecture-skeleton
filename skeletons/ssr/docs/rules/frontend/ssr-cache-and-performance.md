# SSR Cache And Performance

前端缓存不得替代数据库并发约束、权限校验或幂等事实。数据库查询、连接池和 Redis 规则属于配套后端
仓库，不在本骨架分发。

## Generic Next.js Performance

> 通用 Next.js 缓存、流式、bundle、hydration 最佳实践按官方文档执行,本文只列项目专属决策。

## Rendering Mode Policy

- 登录态、权限态、账户、订单、支付、风控、后台操作、租户隔离数据默认动态渲染或 `no-store`。
- 同一路由如果混合公开数据和用户态数据，缓存必须按用户态最严格边界处理，或拆分为独立 server/client 数据岛。
- 每个页面 handoff 必须说明 static、ISR、dynamic、no-store 或 tag-based revalidation 的选择依据。

## Locale Cache Isolation

> locale cache key/tag 隔离与语言切换 revalidation 权威见 [`./ssr-i18n.md`](./ssr-i18n.md)

- 内容受 locale 影响时，cache key/tag 必须包含 locale；未做隔离时使用 dynamic/no-store。

## RSC Serialization

- Server -> Client props 只传客户端实际使用字段，避免把完整后端对象序列化进 HTML/RSC payload。
- 大列表优先在 Server Component 渲染可读内容；只把筛选、分页、选中项、表单草稿等交互状态下沉到 Client Component。
- 日期、金额、枚举等展示字段优先在服务端归一为稳定字符串或轻量 model，再传给客户端。
- 不传 token、权限全集、后端错误详情或不需要的审计字段到客户端。

## Server Runtime

- request/user/session/tenant 等可变数据不放模块级变量，避免并发请求串数据；模块级只放不可变配置、静态资源、编译期常量或有明确 key 隔离的跨请求缓存。
- `after()` 只用于非阻塞日志、审计、分析、通知或清理；不能把必须成功的核心业务副作用(支付、订单状态推进、库存履约、必须成功的写操作)放到响应之后。

## Multi-Instance Deployment

- 多实例部署使用 ISR、tag cache、`revalidatePath` 或 `revalidateTag` 时，必须声明共享 cache handler、共享存储或明确禁用会造成实例间不一致的缓存模式。
- 文件系统默认缓存只适合单实例或可接受短暂不一致的场景；多实例正式环境不得依赖本地磁盘保证 ISR 一致性。
- PM2 cluster 模式必须声明 `instances`、`exec_mode`、`PORT`、`HOSTNAME`、`NODE_ENV`、日志策略和健康检查；多实例缓存按共享 cache handler 或禁用策略处理。
- 健康检查 Route Handler 应返回稳定 JSON/status，不依赖后端慢调用；深度依赖检查另建受控诊断入口。
