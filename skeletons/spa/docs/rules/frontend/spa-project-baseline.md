# SPA 项目基线

## 技术边界

- Vite + React + TypeScript strict
- React Router history 模式
- Ant Design 6 作为交互组件库；页面布局和局部样式使用原生 CSS + CSS 变量；不引入 Tailwind/MUI
- i18next 管理所有用户可见文案
- feature service 是业务 HTTP 出口，底层统一经过 shared API client
- Zustand 仅用于确实跨页面共享的客户端状态

## 分层

```text
router
  -> feature page
  -> feature component / hook / store
  -> feature service
  -> shared api client
```

路由不调 API，不读取 storage，不承载业务计算。feature 之间不直接互相依赖。

## 环境与路径

- `VITE_APP_BASE_PATH` 同时约束 Vite assets、React Router basename 和发布服务路径
- `VITE_API_BASE_URL` 是浏览器请求入口
- `.env.mock/.dev/.test/.prod` 表示业务环境，不是 Node `NODE_ENV`
- 浏览器变量只使用 `VITE_*`

## 发布

- Vite 标准构建直接输出到 `dist`
- `version.json` 固化 release ID 与 base path
- Nginx 直接提供静态文件、history fallback 和 API 代理
- 发布平台负责把 `dist` 放到版本目录；`deploy.sh` 负责软链切换、Nginx reload 与回滚

## 禁止

- 不套用 Next.js、RSC、Server Action 或 BFF 规则
- 不在页面和组件中散落 `fetch`
- 不把 token、密码、真实域名或 `.env.prod` 提交到仓库
- 不让 Nginx 缓存入口 HTML 与版本文件
