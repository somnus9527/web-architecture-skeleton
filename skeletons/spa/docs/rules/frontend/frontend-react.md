# Frontend React

## Project Rules

- Existing project wins: follow its framework, routes, request wrapper, state management, component library, mock convention, style tokens, auth, menu, and permission model.
- This skeleton uses `pnpm` as its package manager; keep all install, script, CI, and release commands on pnpm.
- Existing projects must be assessed before migration. If the existing UI library, mock/API system, env layout, i18n, or directories differ from the new standard, explain impact and wait for approval before broad rewrites.
- Existing or rebuilt projects require a migration status matrix before broad rewrites. Cover UI library, visual parity
  risk, routing, request wrapper, mock/OpenAPI/Prism, env modes, i18n, DTO placement, feature/shared layout, API
  contracts, paired backend tasks/data changes, package manager, and quality tooling. Mark each item as `compliant`,
  `migrated`, `compatible-exception`, or `non-compliant`.
- New SPA projects should use Vite + React + TypeScript + MUI + pnpm unless the user or target repo requires another stack.
- For a new project from this skill folder, run:

```bash
python3 scripts/create_react_app.py /path/to/frontend --name "业务应用名称"
```

- After scaffolding, replace template business language and bring the app to the current baseline: MUI ThemeProvider, Prism/OpenAPI mock, APIClient, env files, feature/shared layout, zustand stores, DTOs, locale files, and quality tooling.
- Keep page components as orchestration layers. Split service methods, DTOs, feature constants, hooks, Dialogs/Drawers, tables, forms, and formatters by responsibility.
- Single-file size: when any source file reaches 1500 lines, split it, refactor it, or extract shared capability before adding more. The hard limit is 2000 lines; exceeding 2000 lines requires explicit user confirmation before continuing. This applies to both frontend and backend source files.
- `@/* -> src/*` alias 与禁止 `../` 父级相对导入的规则权威定义见 [`./frontend-architecture.md`](./frontend-architecture.md),本文不重复。

## MUI Baseline

- New React projects default to MUI with `@mui/material`, `@emotion/react`, and `@emotion/styled`.
- Existing or rebuilt React projects still use MUI-first for newly developed capabilities and newly added interaction surfaces.
- The compatibility exception applies only to pre-existing complex UI being refactored. If MUI migration risks changing established styling, layout, animation, responsive behavior, or brand fidelity, keep that existing UI implementation and record a `compatible-exception`.
- Do not treat MUI as a mandatory retrofit for existing custom commerce pages, marketing pages, games, animated experiences, or other visually complex pre-existing pages. Preserve the current UI when parity is difficult, while migrating architecture/data/contracts underneath it.
- Keep `lucide-react` only for business icons or supplemental icons when MUI icons are not the right fit.
- Wrap the app once with MUI `ThemeProvider` from the app/provider entry.
- Configure a light theme with semantic colors, typography, radius, spacing, and component default props.
- Future dark mode must be controlled through the same theme and locale/provider entry.
- For new projects, prefer MUI native components first; wrap MUI components for feature needs; use custom components only when MUI does not fit the business shape.
- For rebuilt or existing projects, use MUI for new capabilities by default. For existing UI surfaces, introduce MUI components only when they can preserve the current visual result and interaction behavior.

## Interaction Requirements

Frontend output must be genuinely usable, not a static screenshot:

- Include realistic list, filter/search, create or edit, detail, status operation, confirmation, validation, feedback, loading, empty, and error behavior when relevant.
- Lists must support pagination or a clear bounded data set; long lists need pagination, virtualization, or `content-visibility`.
- Forms must include useful validation: required fields, length, amount, email, phone, enum values, date ranges, and cross-field rules when the domain requires them.
- In new projects, create, edit, detail, and confirmation surfaces should use MUI `Dialog` or `Drawer`; do not flatten modal-like interaction into the page body.
- In new projects, dangerous actions must show an MUI `Dialog` confirmation before committing a mock or real state change.
- Success, failure, API error, and business notices should use MUI `Snackbar` + `Alert` in new projects and new capabilities; existing/rebuilt projects may keep current feedback UI only for pre-existing surfaces when changing to MUI would regress styling.
- `Snackbar` defaults: `anchorOrigin={{ vertical: "top", horizontal: "center" }}`, `autoHideDuration={3000}`, and a Slide transition (`TransitionComponent={Slide}`). These are defaults only — callers may override per case.
- New-project forms should use MUI `TextField`, `Select`, `Autocomplete`, `FormControl`, and default helper/error placement.
- New-project menus, Tooltip, Tabs, Pagination, Table, Chip, and Badge should use MUI equivalents.
- Status labels, enum mappings, money/date/file formatting, and risk tone mappings must be centralized.

## Data And Service Shape

- Frontend pages must not directly hardcode business records.
- New projects use Prism examples under `mocks/examples/` as the mock source; runtime mock interfaces must go through
  Prism. Prism-runtime + env switching details live in
  [`./mock-and-integration.md`](./mock-and-integration.md); the `{ data, code, codeMsg }` wrapper rules are canonical
  in [`./api-contracts.md`](./api-contracts.md), not repeated here.
- Fixtures may support unit tests, Storybook, static examples, or OpenAPI example generation, but they must not be the normal runtime fallback for mock mode.
- Put API-facing methods inside the relevant feature service directory or the existing service directory.
- Put API DTOs in `src/types/dto/`.
- Keep TypeScript field names aligned with OpenAPI schemas, API docs, Prism examples, and service payloads.
- Keep service methods stable so real HTTP calls can replace mock internals without rewriting pages.
- Include env-based API switching even while mock mode is the default. New projects use `src/shared/tools/APIClient`; existing projects use their current request wrapper unless migration is approved.
- New projects use `zustand` for store state: global app/runtime state goes in `src/shared/store/`, domain UI state goes in `src/features/<module>/store/`, and server data stays in request hooks unless it must be shared as editable client state.
- Hooks, components, methods, services, and stores must follow single responsibility. Compose primitive hooks such as `useHttp` and `useDebounce` at the domain layer instead of creating mixed hooks like `useHttpDebounce`.

## UI Direction

- For UI, UE, and UX design work, prefer the companion `ui-ux-pro-max` skill when it is installed. Use it to search product type, style, typography, color, chart, UX, and stack guidance before finalizing screens.
- If `ui-ux-pro-max` is not installed or not available in the current Codex session, continue with the defaults in this section, state in the handoff that UI UX Pro MAX was unavailable, and tell the user to install it through their standard skill installation process. Do not include installation steps unless the user asks for them.
- App branch (default for dashboards, CRM, workflow, management, finance, ops, internal tools): operational tools open on the working surface, not a landing-page hero. Show current context, navigation, KPIs, workflow state, actionable lists, owners, freshness, and exceptions in the first screen.
- Landing/brand branch (only when the user asks for a website, landing/product/campaign page, or visual demo): lead with the brand or product name as the first-viewport signal, use one dominant full-bleed visual anchor, keep the hero edge-to-edge (constrain inner text, do not box the whole hero), and avoid hero cards, stat strips, logo clouds, or generic SaaS card grids by default.
- Use quiet hierarchy, stable dimensions, readable spacing, and one primary accent.
- For new projects, use MUI components for interaction surfaces and `lucide-react` for clear tool actions when an icon is needed; keep labels for primary business commands.
- For existing/rebuilt projects, use MUI for new capabilities and preserve established pre-existing visual systems only when MUI would cause visual drift.
- Avoid card mosaics. Use panels only for repeated entities, modals, framed tools, or clear interaction groups.
- Keep cards at 8px radius or less unless an existing design system says otherwise.

See [`./tailwind-v4-system.md`](./tailwind-v4-system.md) for the MUI/Tailwind boundary and [`./responsive-and-breakpoints.md`](./responsive-and-breakpoints.md) for breakpoints and app-scale.

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
