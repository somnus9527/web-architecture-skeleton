# ADR-000：React SPA 项目基线

- 状态：Accepted
- 日期：2026-09-04

## 初始化输入

- [ ] 提供一个不带 `-web` 的小写 kebab-case 项目 ID

应用标题、package、base path、静态目录建议和版本刷新标识均按默认规则派生。API upstream、
正式域名和 Nginx server name 由发布环境另行绑定。

## 决策

新 SPA 应用默认采用 Vite、React、TypeScript、React Router、MUI、Tailwind CSS、i18next、
OpenAPI/Prism 和 Vitest。

应用使用 history 路由。构建期 base path、React Router basename 和 Nginx location 必须使用
同一项目路径。

生产制品由 Vite 直接输出到 `dist/`，由 Nginx 托管静态文件并提供 history fallback。
发布平台负责部署完整 `dist/`，`deploy.sh` 只负责校验 Nginx 配置并执行 reload。

## 原因

- 与 `wgcards-xbox-web` 的现有工程和组件生态一致
- 保留 SPA 的纯静态部署特性，并复用现有 Nginx 入口
- release ID 与版本文件可以解决旧标签页持有旧资源的问题
- 不引入 Node 静态服务或 PM2 运行时

## 约束

- `spa-app` 仅为占位值
- `.env.prod` 和密钥不进入发布包
- `version.json` 和 `index.html` 不得缓存
- hash assets 应长期缓存
- 业务页面不得绕过统一 API client
