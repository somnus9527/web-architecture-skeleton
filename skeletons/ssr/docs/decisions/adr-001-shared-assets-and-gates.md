# ADR-001：共享资产与可执行门禁基线

- 状态：Accepted
- 日期：2026-11-24

## 背景

骨架被复制成多个派生项目后，出现三类反复发生的问题：

1. `.env` 与真实取值被提交进 git（实测 19/32 个仓库）；
2. 通用能力在每个业务模块各写一份，跨仓还会分叉（同一产品线 3–4 个仓的 `api-client.ts` 已出现不同实现）；
3. 规范只写在 Markdown 里，没有可执行检查：CI 存活率 22%、pre-commit 31%。

## 决策

骨架改为「规则单源 + 物化产物 + 可执行门禁」三件套：

1. `rules/<layer>/**` 是规则的唯一可编辑位置；`skeletons/<variant>/docs/rules/**` 由
   `tools/materialize.mjs` 生成，禁止手改。
2. `shared-assets/**` 是 SPA/SSR 强制内置代码（共享 hook、UI 原语、架构测试）的唯一可编辑位置，同样由
   物化下发；RN 使用 `skeletons/rn` 自带的 theme/UI 与架构测试。
3. 门禁必须可执行且会失败：`check:gates`（结构自检）、`check:hygiene`（仓库卫生）、
   架构测试、`quality:check` 聚合，并由 pre-commit 与 CI 双重调用。
4. 例外只能通过 `.agents/architecture-exceptions.json` 登记，必须带 `reason` 与 `expiresAt`，过期自动失效。

## 替代方案

- **只加规则文档**：不解决执行率问题，本次审计已证伪。
- **只在派生项目各自加门禁**：门禁会在复制过程中丢失（CI 22% 存活）。
- **引入模板引擎**：对当前差异规模属于过度设计，目录 + 脚本足够。

## 影响

- 改规则必须改 `rules/` 并运行 `node tools/materialize.mjs`；直接改产物会被 CI 打回。
- 新增共享能力需要先在 `shared-capabilities.md` 登记，否则架构测试会失败。
- 卫生阈值与白名单集中在 `.repo-hygiene.json`，按项目素材规模调整，不放宽检查类别。

## 重新评估条件

- 变体数量继续增长到 O(10) 级，或需要按项目裁剪组件集合时，评估升级为模板包（私有 npm + create CLI）。
- 若共享资产在两个变体出现超过 30% 的分叉段落，重新评估是否拆分公共层。
