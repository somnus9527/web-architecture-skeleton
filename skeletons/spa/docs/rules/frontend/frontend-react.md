# Frontend React

## Project Rules

- Existing project wins: follow its framework, routes, request wrapper, state management, component library, mock convention, style tokens, auth, menu, and permission model.
- This skeleton uses `pnpm` as its package manager; keep all install, script, CI, and release commands on pnpm.
- Existing projects must be assessed before migration. If the existing UI library, mock/API system, env layout, i18n, or directories differ from the new standard, explain impact and wait for approval before broad rewrites.
- Existing or rebuilt projects require a migration status matrix before broad rewrites. Cover UI library, visual parity risk, routing, request wrapper, mock/OpenAPI/Prism, env modes, i18n, DTO placement, feature/shared layout, API contracts, paired backend tasks/data changes, package manager, and quality tooling. Mark each item as `compliant`, `migrated`, `compatible-exception`, or `non-compliant`.
- Keep page components as orchestration layers. Split service methods, DTOs, feature constants, hooks, dialogs/drawers, tables, forms, and formatters by responsibility.
- Single-file size is enforced by the architecture test `file-split-boundary`: page/screen 900, hook 700, service 700, component 800, test 1100, other 1000, hard limit 1300 (with `@generated` exemption). Split before reaching the type threshold; crossing the hard limit fails `quality:check`.
- Stylesheets are covered by the same test with a separate limit: a plain `.css` file may not exceed **1000** lines. A file that only declares design tokens (`:root` / `[data-theme=…]` blocks, ≥80% custom properties) is **exempt** — keeping all tokens in one theme file is the intended layout, not a smell. 样式文件超过上限时按页面/组件边界拆分，而不是拆 token 文件。
- `@/* -> src/*` alias 与禁止 `../` 父级相对导入的规则权威定义见 [`./frontend-architecture.md`](./frontend-architecture.md),本文不重复。

## UI Stack Baseline

- New React projects use **Ant Design 6.x** for interaction components and **native CSS + CSS variables** for layout, page styles and design tokens. Tailwind CSS is not part of the baseline.
- Dependencies: `antd`, `lucide-react`; Next.js App Router projects add `@ant-design/nextjs-registry`. `@ant-design/icons` is not a direct business dependency; antd owns its internal icons.
- Do not install `@mui/material`, `@emotion/*`, `@tailwindcss/*`, or `tailwindcss`. Existing projects may migrate page by page, but must not add new MUI/Tailwind usage.
- Ant Design v6 uses CSS variables internally and may still use its CSS-in-JS runtime; application CSS must not depend on antd internal class names for brand tokens.
- App CSS variables live in `src/shared/theme/tokens.css`; their source values live in `src/shared/theme/design-tokens.ts`; the antd theme is `src/shared/theme/antd-theme.ts`.
- Do not feed CSS variable strings into antd seed tokens (`colorPrimary: 'var(--color-primary)'`); antd's color algorithm needs concrete values. Keep one TS token source and mirror it in CSS.
- Wrap the app once with `ConfigProvider` + `App` from the provider entry. Next.js App Router additionally wraps with `AntdRegistry` for first-screen style extraction.
- Use a single light theme first. Dark/multi-brand themes come later through the same token/provider entry, not a second random provider.
- Design tokens must cover semantic colors, spacing, radius, typography and shadows. Feature code must not hard-code hex colors, font sizes or radii; use CSS variables.
- Icons: **lucide-react is the primary library for page/business icons**; consume them from `@/shared/ui` (the icon facade). Do not import `lucide-react` directly in features. `@ant-design/icons` is owned by antd components internally and must not be a direct business dependency. If lucide lacks an icon, a feature may import a dedicated icon package directly, but must not hand-draw SVG paths or mix multiple icon styles in one component.
- Antd internal icons (Select clear, Modal close, DatePicker arrows, etc.) are left to antd; do not replace them just for visual uniformity.

## Shared UI Boundary

- Business code imports UI only from `@/shared/ui`; it must not import `antd`, `@ant-design/icons`, `lucide-react`, `next/link`-based button internals, or feature UI directly.
- `src/shared/ui` has two kinds of exports:
  - **facade**: a direct or near-direct re-export of an antd primitive (`Input`, `Select`, `Table`, `Modal`); it may be added immediately because it creates no custom API.
  - **composite**: a custom wrapper or pattern (`Button` pending semantics, `PageHeader`, `StatCard`, `EmptyState`, `AsyncState`, `StatusPill`) that adds project-specific behavior.
- A new **composite** may enter `src/shared/ui` only when at least one of these is true:
  1. at least two real feature consumers exist; or
  2. it enforces a cross-cutting invariant (security, accessibility, form semantics, design token); or
  3. it replaces an existing duplicated pattern that has already caused drift.
- Single-use business UI stays in `features/<module>/components/`; do not promote it to `src/shared/ui` “for later”.
- No `OrderTable`, `LoginCard`, `DashboardPanel` or other page-named components in `src/shared/ui`. Shared components must not import `@/features/**`, router modules, `t()`, business enums or API types.
- Every `src/shared/ui` export must be listed in `docs/rules/frontend/ui-style-and-components.md`; the `ui-catalog` test checks the documented paths exist. Do not use the barrel as a dump for one-off components.
- `src/shared/ui` components must not expose `sx`-like escape hatches. Use semantic props and CSS classes; style overrides belong to the component's CSS.

## Interaction Requirements

Frontend output must be genuinely usable, not a static screenshot:

- Include realistic list, filter/search, create or edit, detail, status operation, confirmation, validation, feedback, loading, empty, and error behavior when relevant.
- Lists must support pagination or a clear bounded data set; long lists need pagination, virtualization, or `content-visibility`.
- Forms must include useful validation: required fields, length, amount, email, phone, enum values, date ranges, and cross-field rules when the domain requires them.
- Create, edit, detail, and confirmation surfaces use antd `Modal` / `Drawer`; do not flatten modal-like interaction into the page body.
- Dangerous actions must show an antd `Modal.confirm` / `Popconfirm` before committing a state change.
- Success, failure, API error, and business notices use antd `App.useApp()` (`message`, `notification`, `modal`), not static `message.*` / `Modal.*` methods that lose theme and locale context.
- New-project forms use antd `Form`, `Input`, `InputNumber`, `Select`, `DatePicker`, `Checkbox` and default label/error placement, wrapped by `src/shared/ui` where the project needs a stable API.
- New-project menus, Tooltip, Tabs, Pagination, Table, Tag and Badge use antd equivalents. Use native CSS for page layout and custom panels.
- Status labels, enum mappings, money/date/file formatting, and risk tone mappings must be centralized.

## Data And Service Shape

- Frontend pages must not directly hardcode business records.
- New projects use Prism examples under `mocks/examples/` as the mock source; runtime mock interfaces must go through Prism. Prism-runtime + env switching details live in [`./mock-and-integration.md`](./mock-and-integration.md); the `{ data, code, codeMsg }` wrapper rules are canonical in [`./api-contracts.md`](./api-contracts.md), not repeated here.
- Fixtures may support unit tests, Storybook, static examples, or OpenAPI example generation, but they must not be the normal runtime fallback for mock mode.
- Put API-facing methods inside the relevant feature service directory or the existing service directory.
- Put API DTOs in `src/types/dto/`.
- Keep TypeScript field names aligned with OpenAPI schemas, API docs, Prism examples, and service payloads.
- Keep service methods stable so real HTTP calls can replace mock internals without rewriting pages.
- Include env-based API switching even while mock mode is the default. New projects use `src/shared/tools/api-client.ts`; existing projects use their current request wrapper unless migration is approved.
- New projects use `zustand` for store state: global app/runtime state goes in `src/shared/store/`, domain UI state goes in `src/features/<module>/store/`, and server data stays in request hooks unless it must be shared as editable client state.
- Hooks, components, methods, services, and stores must follow single responsibility. Compose primitive hooks such as `useRequest` and `useDebouncedValue` at the domain layer instead of creating mixed hooks like `useRequestDebounce`.

## UI Direction

- For UI, UE, and UX design work, prefer the companion `ui-ux-pro-max` skill when it is installed. Use it to search product type, style, typography, color, chart, UX, and stack guidance before finalizing screens.
- If `ui-ux-pro-max` is not installed or not available in the current session, continue with the defaults in this section, state in the handoff that UI UX Pro MAX was unavailable, and tell the user to install it through their standard skill installation process. Do not include installation steps unless the user asks for them.
- App branch (default for dashboards, CRM, workflow, management, finance, ops, internal tools): operational tools open on the working surface, not a landing-page hero. Show current context, navigation, KPIs, workflow state, actionable lists, owners, freshness, and exceptions in the first screen.
- Landing/brand branch (only when the user asks for a website, landing/product/campaign page, or visual demo): lead with the brand or product name as the first-viewport signal, use one dominant full-bleed visual anchor, keep the hero edge-to-edge (constrain inner text, do not box the whole hero), and avoid hero cards, stat strips, logo clouds, or generic SaaS card grids by default.
- Use quiet hierarchy, stable dimensions, readable spacing, and one primary accent.
- Use antd components for interaction surfaces and `lucide-react` for clear tool actions when an icon is needed; keep labels for primary business commands.
- Avoid card mosaics. Use panels only for repeated entities, modals, framed tools, or clear interaction groups.
- Keep cards at 8px radius or less unless the design token says otherwise.

See [`./native-css-and-tokens.md`](./native-css-and-tokens.md) for CSS variable/token rules, [`./ui-style-and-components.md`](./ui-style-and-components.md) for the shared UI catalog, and [`./responsive-and-breakpoints.md`](./responsive-and-breakpoints.md) for breakpoints and app-scale.

## TypeScript And Comments

- TS 命名(`I` 前缀 interface、不强制 `T` 前缀的 `type`、enum/union 业务名)权威定义见 [`../shared/typescript.md`](../shared/typescript.md),本文不重复。
- Use React component names in PascalCase.
- Use normal files and directories in kebab-case unless the project already uses another convention.
- Add concise Chinese comments only where they help: mock replacement points, important TSX sections, complex business branches, service behavior, and non-obvious formatter logic.
- Before modifying hand-written TS/TSX/React templates, follow the global TypeScript, frontend, and comments rule references configured by the project.

## Performance

- 避免 loader / action / API handler / client hook 串行 waterfall;相互独立的异步请求尽早发起并用 `Promise.all` 并发。
- 罕用的重界面(图表、编辑器、地图、导出、仅管理员工具)按需动态导入,保持静态路径可分析。
- 长列表先上分页、虚拟化或 `content-visibility`,再渲染大 DOM 树。
- 通用 React 性能(memo 取舍、effect/render 派生、startTransition、passive listener 等)按行业标准执行,本文只列项目专属决策。

## Verification

Run the available project checks after frontend changes:

- Install dependencies if needed.
- Run typecheck or build; common commands are `pnpm typecheck`, `pnpm build`, or the target repo's existing script.
- Start or preview locally when feasible.
- Inspect the UI in a browser or screenshot when the environment supports it.

If a check cannot run because dependencies, network, scripts, or project files are missing, state the exact reason in the final handoff.

## Frontend React（SPA 变体）

- 新 SPA 项目使用 Vite + React + TypeScript + Ant Design 6 + 原生 CSS/CSS 变量 + pnpm，除非目标仓库已有其他技术栈。
- 从当前骨架创建项目时使用 `.agents/skills/initialize-spa-project/SKILL.md`，不要执行仓库外的脚手架脚本。
- 初始化后把示例业务语言替换为真实业务，并确认基线：Ant Design `ConfigProvider` + `App`、Prism/OpenAPI mock、
  `src/shared/tools/api-client.ts`、环境文件、feature/shared 分层、zustand store、DTO、locale 文件和
  质量门禁。
