# Frontend Architecture

## Existing Projects

- Identify the current framework, UI library, request wrapper, mock system, env files, i18n, route/menu/auth model, and directory layout before changing code.
- If the current project does not match the new standard, explain the difference and ask before reshaping directories, dependencies, scripts, config, or request flow.
- Mature existing UI libraries and request wrappers win unless the user approves migration.
- UI-library migration for pre-existing surfaces in existing or rebuilt projects is allowed only when visual and interaction parity can be preserved. If a UI migration would regress complex existing styling, keep that current UI layer and migrate data/contracts/architecture underneath it. Newly developed capabilities in the same project follow the project baseline (antd 6 + native CSS) unless the user explicitly approves another component system.
- Produce a migration status matrix for existing or rebuilt projects before broad rewrites, and do not present `non-compliant` items as done.
- After a user declines migration in one project, keep using that project's current convention for similar follow-up work unless the user explicitly reopens the decision.

## New Project Layout

New React projects should use this layout unless the user specifies another one:

```text
src/
  app/                  # app bootstrap, providers, router, runtime for shared, or top-level layout
  features              # business scope
    /<module>/          # pages, components, hooks, service, constants for one domain
      tools/            # tools for domain
      components/       # components for domain
      types/            # typescript types for domain
      hooks/            # hooks for domain
      store/            # store for domain
      view/             # child view for domain
        ...             # structure like feature module
      index.tsx         # domain entry component
  shared/
    tools/              # API client, pure functions, class, and business-agnostic helpers
    config/             # common config
    hooks/              # common react hooks
    store/              # global store
    components/         # app-level shared providers/router
    ui/                 # shared UI facade, primitives and composites
    ...                 # other type tools
  types/
    dto/                # API DTO interfaces and type aliases
    enum/               # typescript enum
    ...                 # other typescript types
  locale/               # i18next setup and locale dictionaries
    zh-CN.json          # zh-CN material
    en-US.json          # en-US material
    ...                 # other language material
```

Do not create empty directories just to make the tree look complete.

Use each folder by ownership, not by file extension alone:

- `app/` owns runtime wiring: provider composition, route/bootstrap entry, top-level layouts, and app shell code that is not a business domain.
- `features/<module>/` owns one business domain. Domain pages, domain components, domain hooks, domain services, domain constants, domain stores, and domain-only tools stay together.
- `features/<module>/view/` is only needed when a domain has nested child views or sub-flows with their own internal structure.
- `shared/` is for cross-domain capabilities that have already proven reusable. Do not move one-off business code into `shared` just because it looks generic.
- `types/dto/` is for API contract DTOs; SSR app-private DTOs may live in `src/bff/dto/`. Domain-only UI types
  should stay inside `features/<module>/types/`.

## Import Alias

- Configure a source alias `@/* -> src/*` in TypeScript and every active tool that resolves imports: Vite, test runner, lint/import checks, Storybook, Vitest/Jest, and any bundler-specific config present.
- Do not introduce parent relative imports such as `../types`, `../../shared`, or `../../../tools`. Only same-directory imports such as `./formatters` may use relative paths; all other app imports must use the alias.

## API client

- New projects must use `src/shared/tools/api-client.ts` as the only request entry.
- Pages, components, hooks, and services must not call `fetch` directly or build base URLs themselves.
- API client handles base URL selection, path joining, `authorization`, JSON body, `Content-Type`, timeout, HTTP non-2xx, `code !== "200"`, network errors, and a consistent error object or message.
- API client must not hardcode user-visible fallback messages. Missing config, timeout, network failure, malformed response, and other frontend-generated `codeMsg` values must use locale-backed messages or return stable error codes for the UI layer to translate.
- Use env vars to choose mock, dev, test, or prod services; do not scatter service URLs through components.
- `{ data, code, codeMsg }` 包装契约(success `code === "200"`、缺包装即契约错误、不得把裸 payload 当成功响应)权威定义见 [`./api-contracts.md`](./api-contracts.md),API client 在 mock/dev/test/prod 远程模式必须遵守,本文不重复。
- When Prism/OpenAPI mock support exists, mock-mode service calls must reach Prism through API client or the approved request wrapper. Do not return hardcoded mock responses from runtime service code.

## Stores

- Read `store.md` before adding or changing Zustand stores, persisted state, auth/session state, locale/currency state, business-domain shared state, or API client runtime-context wiring.
- Store ownership follows scope first, then business ownership: global stores live in `src/shared/store/`; domain stores live in `src/features/<module>/store/`; component-tree-only state uses local state or React Context.
- Do not create catch-all stores. Split global business stores by business concern and keep non-business global state grouped by runtime responsibility.

## Feature Hooks

- Each business domain may have `features/<module>/hooks/` when there is real domain logic to share.
- Domain request hooks such as `useItems` or `useSampleDashboard` must call API client through the domain service layer and expose at least `data`, `loading`, and `error`; add `refetch`/`mutate`/`reset` only when the flow needs them.
- Cross-domain primitive hooks live in `src/shared/hooks/` and are catalogued in [`./shared-capabilities.md`](./shared-capabilities.md) (`useRequest`, `useAsyncAction`, `useDebouncedValue`, `useDisclosure`); business orchestration hooks stay in `src/features/<module>/hooks/`. Compose primitives — do not write a per-module request hook or a mixed hook like `useHttpDebounce`.

## DTOs And Types

- Put API DTOs in `src/types/dto/` (SSR app-private DTOs may live in `src/bff/dto/`).
- TS 命名(`I` 前缀 interface、不强制 `T` 前缀的 `type`、enum/union 业务名)权威定义见 [`../shared/typescript.md`](../shared/typescript.md),本文不重复。
- DTO fields must match OpenAPI schemas, API docs, Prism examples, and service payloads.
- Required/optional flags, enums, nested object shapes, array item shapes, and error payloads must match OpenAPI. OpenAPI schemas for frontend-consumed data must be explicit enough to catch drift.
- Do not use OpenAPI DTO generation by default; hand-write DTOs from the contract and business semantics.

## Component Split Rules

- Components, hooks, methods, stores, and tools follow single responsibility. Page components orchestrate data loading, business sections, Dialog/Drawer state, and Snackbar coordination; business components render domain interaction and do not know API client details.
- Keep constants and enum label maps inside the feature `constants` directory unless they are truly cross-domain.
- Size limits are enforced by `file-split-boundary`: page/screen 400, hook 200, service 200, component 300, test 600, hard limit 800 (`@generated` exempt). Around the type threshold, evaluate splitting sections/forms/tables/Dialogs/hooks; do not extract a single-use static JSX fragment under 20 lines without independent business meaning.
