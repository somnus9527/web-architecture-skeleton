# RN 应用初始化清单

复制骨架后按顺序完成，全部勾选前不要开始业务开发。

## 1. 项目身份

- [ ] 执行已安装的 `initialize-project` 技能（type=rn），项目名使用小写 kebab-case
- [ ] `package.json` 的 `name` 已改为项目 ID
- [ ] `app.json` 的 `expo.name`、`expo.slug`、`expo.scheme` 已与项目一致
- [ ] `.agents/rn-project.md` 已生成
- [ ] 两份 i18n 资源的 `app.title` 已改为应用展示名

## 2. 环境与后端

- [ ] `env/.env.<environment>.example` 只包含 `EXPO_PUBLIC_*` 变量，未提交真实取值
- [ ] 已执行 `pnpm env:init <dev|test|prod>` 生成本地 `env/.env.<environment>`（不入库）
- [ ] `EXPO_PUBLIC_API_BASE_URL` 指向真实网关地址，未使用占位域名
- [ ] 涉及凭证时确认只进 SecureStore，不写入 AsyncStorage

## 3. 验证

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm format:check`
- [ ] `pnpm check:hygiene`
