# Frontend Templates

**按需抄写**的文件级模板。与 `shared-assets/` 的区别：

- `shared-assets/` 是**强制内置**代码，物化进每个 skeleton，随项目一起交付。
- `templates/` 是**参考模板**，不随项目交付，写新模块时按需复制并改成业务实现。

模板不参与编译，因此每次改动规则后都要回看这里，避免抄到过时写法。判断标准：模板里的模式必须能在
`skeletons/spa` 或 `skeletons/ssr` 的现有代码中找到对应实现。

| 模板                 | 用途                                               | 对应规则                                  |
| -------------------- | -------------------------------------------------- | ----------------------------------------- |
| `feature-service.md` | feature service 层：调用 APIClient、保持方法名稳定 | `rules/frontend/api-contracts.md`         |
| `feature-store.md`   | feature 级 zustand store：只放跨组件共享的 UI 状态 | `rules/frontend/store.md`                 |
| `feature-page.md`    | 页面编排层：数据、筛选、弹窗状态与三态             | `rules/frontend/frontend-architecture.md` |
