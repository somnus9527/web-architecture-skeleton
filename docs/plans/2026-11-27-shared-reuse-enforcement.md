# 共享复用与 UI 边界：可失败检查方案

- 日期：2026-11-27
- 状态：P0、P1 已落地（2026-11-27）：注册表、R1–R6、L2 相似度、baseline 与例外到期、接线与夹具；UI facade 与 catalog 属 P2。
- 范围：`test/web-architecture-skeleton`
- 定位：规则、注册表、脚本在本仓库定义，经 `tools/materialize.mjs` 下发到 `skeletons/{spa,ssr,rn}`；**实际生效点在据此初始化出来的项目实例**，本仓库只负责出货与自证。
- 前置：[共享复用与 UI 基础设计](./2026-11-26-shared-reuse-and-ui-foundation.md)、[五项优化](./2026-11-25-five-optimizations.md)

## 0. 结论

1. **不预先造组件库**。只补“门禁禁了却没有合法出口”的组件，其余等第二个真实使用方。
2. **只做两件事**：让能力可查询（注册表 + `reuse:list`），让重复实现会失败（`check:reuse`）。
3. **没有合法替代品的规则不启用**；每条命中必须给出可直接粘贴的 import。

## 1. 现状与失效点

| 失效点           | 现状                                                                                                                                                | 手段                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 不知道有现成的   | `src/shared/hooks` 只有 4 个文件，无机器可读清单，AI 靠读规则文档                                                                                   | `docs/capabilities.json` + `pnpm reuse:list` |
| 复用成本高于重写 | 无生成器，import 路径靠记忆                                                                                                                         | 失败信息直接给 import；`gen:hook` 后置       |
| 重写了也没事     | `hook-duplication` 只扫 `features/**/use-*.ts` 的 `useEffect + setLoading`；组件内联、`setTimeout` 去抖、feature 自建 `modal.tsx`、深引 barrel 全漏 | `scripts/check-reuse.mjs` 三层检测           |

## 2. 通用能力：发现 + 失败

### 2.1 注册表

新增 `shared-assets/docs/capabilities.json`，随 `shared-assets/docs/` 物化到每个项目的 `docs/capabilities.json`。

```json
[
  {
    "id": "use-request",
    "kind": "hook",
    "export": "useRequest",
    "import": "@/shared/hooks",
    "path": "src/shared/hooks/use-request.ts",
    "purpose": "异步读取的 data/loading/error/refetch/mutate",
    "replaces": ["手写 loading/error 三态", "feature 内自建 fetch wrapper"],
    "owner": "frontend-platform",
    "since": "2026-11-27"
  }
]
```

`kind` 取值 `hook | util | service`。UI 组件走独立 catalog（见 §3.6），不混进本表。

### 2.2 L1 签名检测（pre-commit，毫秒级）

只扫 `src/{features,app,router}/**`，测试与 mock 排除。

| #   | 命中                                                                                                                                     | 提示替代                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| R1  | `useEffect(` + `set(Loading\|IsLoading\|LoadState\|Pending)` + 异步边界（`await` / `.then(` / `fetch(` / `*.Service.`）                  | `useRequest`（读）/ `useAsyncAction`（写）    |
| R2  | 同文件 `setTimeout` + `clearTimeout`，且回调内调用 `set*`                                                                                | `useDebouncedValue`                           |
| R3  | 直接 `localStorage` / `sessionStorage` / `matchMedia`                                                                                    | store 或共享 hook                             |
| R4  | `features/**` 新建通用名文件：`button/input/select/textarea/modal/dialog/table/card/badge/pagination/form-field`（kebab-case，精确匹配） | 进 `src/shared/ui` 并登记 catalog             |
| R5  | 深引 `@/shared/hooks/*`、`@/shared/ui/*`，而非 barrel                                                                                    | 改从 `@/shared/hooks`、`@/shared/ui` 导入     |
| R6  | `features/**` 直接 `fetch(` 或自建 axios 实例                                                                                            | `@/shared/tools/api-client` + feature service |

R4 的 P0 名单只含已有 `src/shared/ui` 出口的 9 个名字（`button` / `input` / `select` / `async-state` / `empty-state` / `page-header` / `stat-card` / `field-row` / `status-pill`）；`modal` / `dialog` / `table` / `textarea` / `card` / `badge` / `pagination` 随 P2 facade 落地后再启用，避免“禁了但只能违规”。

不新增“div 伪按钮”规则：`eslint-plugin-jsx-a11y` 的 `recommended` 已在，覆盖 `click-events-have-key-events` / `no-static-element-interactions`，避免同一约束两套实现。

### 2.3 L2 结构相似（pre-push / CI）

- **对象**：本次改动文件的导出函数两两比较 + 与注册表能力的指纹比较。
- **归一化**：去注释、空行、import，按 token 5-gram 计算 Jaccard。
- **阈值**：相似度 ≥ `0.82` 且 token ≥ `120` 才报，附两边片段与疑似替代。
- **范围**：`src/{features,shared}/**`，排除 test/mock/locale。
- 已实现：5-gram Jaccard，阈值 `0.82`，少于 120 token 不比；先按 token 数比值 0.77–1.3 预筛，注册表能力文件也参与比较（注册表之间互不比较）。
- 只在 `--tracked` 与增量 `--files` 上跑，不进 pre-commit；一次最多列 10 对，其余汇总提示。

L3（AST 语义级）不做，收益不抵依赖成本。

### 2.4 例外与 baseline

- **例外**：沿用 `.agents/architecture-exceptions.json`，条目增加可选 `rule` 字段；`expiresAt` 距今天不得超过 90 天，过期、超期或缺 `reason` 都直接失败。
- **baseline**：当规则上线晚于项目初始化（含后续新增规则）时，运行 `--baseline` 生成 `.agents/reuse-baseline.json`，记录 `rule + path + 代码片段 hash`；代码一改 hash 失配，必须重新判定，防止“一次豁免永久生效”。到期日 90 天，过期门禁失败。新初始化项目不需要 baseline。

### 2.5 接线

| 位置                                                           | 改动                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tools/project/scripts/check-reuse.mjs`                        | 新增；支持 `--staged` / `--tracked` / `--files` / `--list` / `--baseline`              |
| `skeletons/{spa,ssr}/package.json`                             | 加 `check:reuse`、`reuse:list`，并把 `check:reuse` 加进 `quality:check`、`verify:push` |
| `tools/project/scripts/check-staged.mjs`                       | pre-commit 分片里加“共享能力复用”一项（不直接改 husky）                                |
| `shared-assets/src/test/architecture/reuse-registry.test.ts`   | 新增：路径存在、导出匹配、`src/shared/{hooks,ui}` 全登记                               |
| `shared-assets/src/test/architecture/hook-duplication.test.ts` | 已删除，规则由 `check-reuse` 的 R1/R3 接管                                             |
| `shared-assets/src/shared/hooks/index.ts`                      | 新增 barrel，作为 R5 的合法出口                                                        |

### 2.6 四类载体

| 载体 | 内容                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| 规则 | `shared-capabilities.md` 增“先查后写”流程、门禁清单、例外与 baseline 政策                    |
| 骨架 | `shared-assets/docs/capabilities.json`；`materialize.mjs` 增加“无共享 hook 的变体跳过注册表” |
| 脚本 | `check-reuse.mjs` + package.json + husky + 架构测试                                          |
| 技能 | `initialize-*` 技能自检 `check:reuse` 存在；`sync-architecture-rules` 确认新规则随物化下发   |

## 3. UI 边界

### 3.1 判据

满足任一条才禁，否则不禁：

1. 裸用造成视觉/交互漂移；
2. 裸用丢失横切约束（pending、禁用态、错误态、focus ring、token）；
3. 裸用让门禁指不到替代品。

配套铁律：**没有合法出口的标签不许先禁**。

### 3.2 名册

| 标签                                                     | 结论                            | 理由                        | 封装内部语义                      |
| -------------------------------------------------------- | ------------------------------- | --------------------------- | --------------------------------- |
| `<button>`                                               | 禁裸用                          | pending/禁用/tone 漂移      | `native-backed`                   |
| `<input>` 文本类                                         | 禁裸用                          | 表单语义、错误态            | `native-backed`                   |
| `<input type=checkbox/radio>`                            | 禁裸用                          | label 关联、错误态          | `native-backed`                   |
| `<textarea>`                                             | 禁裸用                          | 同上                        | `native-backed`                   |
| `<select>`                                               | 禁裸用                          | 视觉不可控、跨端不一致      | `aria-pattern`（见 §3.4）         |
| `<dialog>`                                               | 禁裸用                          | 焦点/top-layer/样式必须统一 | `aria-pattern`（antd Modal）      |
| `<table>`                                                | 禁布局表；数据表走 shared Table | 语义必须保留                | `native-backed`（真实 `<table>`） |
| `<a>`                                                    | **永不禁**                      | 可爬链接是 SEO 命脉         | `native-backed`                   |
| `<form>` `<label>` `<fieldset>`                          | 不禁                            | 表单语义                    | —                                 |
| `<h1>` `<main>` `<nav>` `<article>` `<section>` `<time>` | 不禁                            | 文档结构语义                | —                                 |

### 3.3 四个 facade

只补“禁了没出口”的四个，不扩散：

| 组件       | 实现            | 说明                                                                |
| ---------- | --------------- | ------------------------------------------------------------------- |
| `Dialog`   | antd Modal 封装 | 不用原生 `<dialog>`：top-layer 会盖住 portal 到 body 的 antd 下拉层 |
| `Table`    | antd Table 封装 | 内部是真实 `<table>`，语义不丢；统一空态/分页/列宽                  |
| `TextArea` | antd 薄壳       | 内部原生 `<textarea>`                                               |
| `Checkbox` | antd 薄壳       | 内部原生 `input[type=checkbox]`                                     |

`Badge` / `Spinner` / `Skeleton` / `Alert` 等没有裸用入口，继续不造。

### 3.4 Select 的取舍与 SEO 结论

**采用 antd Select（ARIA combobox），放弃移动端原生选择器。**

SEO 判断：

- option 文本不是可索引正文；antd Select 的 SSR HTML 只渲染选中值，选项在弹层。两者没有排名差异。
- 排名面是可爬 `<a href>`、SSR 正文、metadata 与 JSON-LD，本方案全部保留。
- 现状证据：`skeletons/{spa,ssr}/src` 中 `<select>` / `<dialog>` / `<table>` 出现次数为 0，语言切换已走 `@/shared/ui`；本条是**把现状写死**，不改任何现有页面 DOM。

**不设“公开页豁免”**：

- 收益为 0，因为不影响 SEO；
- 静态门禁无法识别“公开页”，只能按目录划，等于给 AI 一个可挪代码的后门；
- 公开页比控制台更需要视觉统一。

若将来某页确实需要选项文本被收录，正确做法是渲染成可见链接/列表，而不是回退到原生 `<select>`。

移动端原生选择器的缺失作为已知取舍记录在 ADR；真出现体验问题再加 `NativeSelect`，而不是现在维护两套。

### 3.5 规则清理

- 删除 `ui-style-and-components.md` 的“派生项目自建”表（`ConsoleButton` / `ConsoleModal` / `DateFilterField` / `AnimatedProgress` 等 8 项）。
- 文档中不得出现“骨架未提供却要求使用”的组件名；把其中通用的视觉结论（状态胶囊 5 色、tone 语义、表格列宽、禁用态色值）保留为不绑定组件名的通用规则。
- 项目自建组件只能登记在 `ui-catalog.json` 的 `scope: "project"`，不得藏在 `features/**`。

### 3.6 UI catalog

`shared-assets/docs/ui-catalog.json` → 项目 `docs/ui-catalog.json`：

```json
[
  {
    "name": "Button",
    "path": "src/shared/ui/button.tsx",
    "export": "Button",
    "status": "stable",
    "since": "2026-11-27",
    "owner": "frontend-platform",
    "scope": "skeleton",
    "dom": "native-backed",
    "a11y": ["keyboard", "disabled", "aria-busy"]
  }
]
```

校验：barrel 导出 ↔ catalog ↔ 文件三方一致；`src/shared/ui/*.tsx` 全部登记；`status=deprecated` 必须有 `replacedBy` 与移除日期；`dom=aria-pattern` 必须有 `a11y` 字段与对应测试。

## 4. 验收

负向（必须失败）：

1. 组件内联 `useEffect` + `setLoading`；
2. 手写 `setTimeout` 去抖；
3. `features/**/modal.tsx`；
4. 深引 `@/shared/ui/button`；
5. 复制 `useRequest` 函数体（相似度命中）；
6. 新增 `src/shared/hooks/use-x.ts` 未登记；
7. 业务页写原生 `<select>`；
8. 业务页写 `<table>` 做布局。

正向（必须通过）：正常组合 `useRequest` + `useAsyncAction`；业务特有 `useOrderFilters`；`OrderTable`；已登记组件。

实例验证：

- `check-init-smoke` 在临时目录初始化一个项目并跑 `pnpm check:reuse`，证明“刚初始化就是通的”；
- `quality.yml` 变体矩阵在三端各跑一次；
- 用 `initialize-*` 技能在一个**全新目录**初始化真实项目，跑 `pnpm quality:check`，确认门禁默认生效。这是本方案的最终验收；只新建项目，不触碰任何现有项目。
- 在 `skeletons/{spa,ssr,rn}` 自身与合成夹具上 dry-run，人工判定每条命中，**准确率 ≥ 90% 才从 CI 升级到 pre-push**。全程只读本仓库，不扫描任何外部项目。

## 5. 分期

| 期  | 内容                                          | 工作量 |
| --- | --------------------------------------------- | ------ |
| P0  | registry + 校验测试 + R1–R6 + 接线 + 负向夹具 | 2–3 天 |
| P1  | L2 相似度 + baseline + 新项目真实初始化验收   | 2 天   |
| P2  | UI 规则清理 + 4 个 facade + catalog 元数据    | 2 天   |

RN 变体只接 L1 的 R1/R2/R3（无 DOM，不涉及 UI 名册）。

## 6. 待确认

1. L2 阈值先定 `0.82`、只在 CI 阻断，dry-run 后再进 pre-push；
2. baseline 与例外有效期统一 90 天；
3. dry-run 只在本仓库三端与合成夹具上做，是否足够作为上线判据。

## 附录 A：交接 prompt

```text
在 /Users/somnuszyy9527/workspace/test/web-architecture-skeleton 实施 docs/plans/2026-11-27-shared-reuse-enforcement.md，按 P0 → P1 → P2 分批，每批独立提交。

硬约束：
1. 规则在 rules/ 单源，物化用 node tools/materialize.mjs；不要直接改 skeletons/*/docs/rules。
2. 新脚本放 tools/project/scripts/check-reuse.mjs，由 materialize 下发；skeletons/*/package.json 与 .husky 手工接线。
3. 没有合法替代品的规则不许启用；每条失败信息必须给出可直接粘贴的 import。
4. 不给“公开页”开口子；<a>、<form>、<label>、标题与结构标签永久豁免。
5. UI 只补 Dialog / Table / TextArea / Checkbox 四个 facade，其余不造。
6. 删除 hook-duplication.test.ts 前，确认 R1/R3 已在 check-reuse 覆盖且有夹具。

验证：node tools/materialize.mjs && node tools/check-doc-links.mjs；各变体 pnpm --dir skeletons/<v> check:reuse、lint、typecheck、test；node tools/check-init-smoke.mjs。
提交信息用 conventional commits，单批单主题。
```
