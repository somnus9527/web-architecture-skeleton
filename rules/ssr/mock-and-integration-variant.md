## Mock And Integration（SSR 变体）

- 本骨架的 Next.js SSR/BFF 运行时使用服务端 gateway 规则，见
  [`ssr-contracts-and-mock.md`](./ssr-contracts-and-mock.md) 与 [`ssr-runtime-config.md`](./ssr-runtime-config.md)。
- 切换 mock 与真实上游要通过服务端 env 加载器与 gateway 配置完成，不在页面或组件里分支。
- 前端 service 方法、adapter 映射、gateway 边界与 DTO 名称在替换上游时必须保持稳定。
