# Responsive And Breakpoints

> Scope: device support matrix, named breakpoints, MUI/Tailwind alignment, adaptation order, app-scale, and acceptance viewports. Applies to all apps (SPA + SSR/BFF). The single source for breakpoint values is `packages/ui`.

## Device Support Matrix

- Each app must declare its supported device range in its README or project baseline. Do not guess.
- Tiers and ranges:

| Tier    | Range       | State                                      |
| ------- | ----------- | ------------------------------------------ |
| Mobile  | `<48rem`    | must-support / best-effort / not-supported |
| Tablet  | `48-64rem`  | same                                       |
| Laptop  | `64-80rem`  | same                                       |
| Desktop | `80-120rem` | same                                       |
| Wide/4K | `>=120rem`  | same                                       |

- If an app has not declared a matrix, do not assume one. Flag it for the owner before building responsive structure.

## Named Breakpoints (Tailwind v4)

New or controllable projects use named breakpoints and must not use Tailwind defaults `sm/md/lg/xl/2xl`:

| Name      | Value   | Meaning     |
| --------- | ------- | ----------- |
| `tablet`  | `48rem` | from 768px  |
| `laptop`  | `64rem` | from 1024px |
| `desktop` | `80rem` | from 1280px |
| `wide`    | `90rem` | from 1440px |

Rules:

- Mobile styles are the unprefixed default (mobile-first).
- Breakpoint units use `rem`, not `px`.
- Do not add `pc` / `mobile` breakpoint names (avoid confusion with terminal mode).
- Do not add Tailwind breakpoints for 4K/2K. Handle length scaling via `app-scale`.

## MUI Breakpoint Single Source

MUI defaults `sm/md/lg/xl` conflict with this system. Projects using MUI must override breakpoints once in `packages/ui` (or the project's single theme entry) and reuse across all apps.

- Keep `xs` as fallback; enable `tablet/laptop/desktop/wide`.
- Disable or avoid MUI default `sm/md/lg/xl`.
- No per-app `createTheme` breakpoint overrides.
- Tailwind `tablet:` and MUI `theme.breakpoints.up('tablet')` must resolve to the same pixel value.

## Adaptation Order

When handling PC/Mobile or multi-resolution differences, decide in this order and do not skip levels — if a lower level solves it, do not reach for a higher one:

1. Whole-page structural difference (e.g. PC sidebar + table vs Mobile filter button + card stream) -- fork the page tree.
2. Visual-parameter difference (spacing, font size, density) -- prefer CSS variables or `app-*` utilities, do not fork the tree.
3. Component-local width difference -- use container queries, not the whole-page viewport.
4. Small global change -- use the shared Tailwind breakpoints.

### SPA two-terminal selection

SPA apps may use terminal mode + async dispatch:

- Terminal state is held by a project-level store based on `window.matchMedia`, with resize support and manual switch where needed.
- Dispatch `pc/mobile` implementations through a shared `TerminalSwitch` (or the project equivalent).
- Prefer async loaders `() => import(...)` when the two implementations are sizable.
- Fork `ui/pc` vs `ui/mobile` only on clear structural difference; visual-parameter differences go through CSS variables / `app-*`.

Forbidden:

- Scattered `if (isMobile)` across business components.
- Bypassing the shared store with ad-hoc `useMediaQuery` terminal checks.
- Controlling the same block with terminal mode and media query at the same time.

### SSR two-terminal selection (Next App Router)

The server cannot reliably know the client viewport. SSR/BFF projects follow:

| Case                                 | Recommended                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Visual difference only               | Single component tree + Tailwind breakpoints / CSS variables                 |
| SEO-critical + structural difference | CSS-only dual-render: both structures in the HTML, show/hide via media query |
| Non-SEO + structural difference      | Deferred dispatch inside a Client Component                                  |
| Heavy Client Component on one side   | SEO-critical: `dynamic({ ssr: true })`; only non-SEO may use `ssr: false`    |

Hard forbidden:

- User-Agent sniffing in middleware/proxy to render a different component tree, unless an ADR explicitly approves it and documents the CDN cache strategy.
- `useMediaQuery` / `window.matchMedia` branching inside a Server Component.
- First-paint layout corrected by `useEffect`.
- `dynamic({ ssr: false })` inside a Server Component; push it down to a Client Component.

## app-scale And Length Parameters

`app-scale` uniformly handles length parameters across resolutions (4K/2K fonts too small, Mobile fonts too large).

Ownership:

- Shared CSS template lives in `packages/ui/src/styles/responsive.css` (or the project's single style entry).
- MUI breakpoint override lives in `packages/ui` (or the project's single MUI theme entry).
- Each app only imports/reuses; it never re-declares these.

Applies to:

- Font size, line height, width/height, radius, gap, padding, margin, positional offsets.
- Elements that need a uniform proportional scale across breakpoints.

Forbidden:

- Stacking page-level `transform: scale(...)` on top of `app-scale`.
- Using `app-*` on fixed parameters that should not scale (stroke width, pixel-aligned icons).
- Re-declaring MUI breakpoints per app.

## Acceptance Viewports

When delivering responsive-affected pages, the handoff must state which resolutions were verified. SSR pages or layout-risky pages verify at least:

- `375px` -- Mobile baseline.
- `768px` -- Tablet start.
- `1280px` -- Desktop start.
- `1920px` -- design baseline.
- `2560px` -- 4K sample; if not testable this round, state the reason and residual risk.

Checks:

- First paint correct; no layout shift, content flicker, or hydration warning.
- Text does not overflow buttons, tabs, cards, table cells, or mobile columns.
- Control sizes stay stable across hover/loading/empty/filtered states.
- `app-scale` font sizes and spacing transition smoothly, no jumps.
- SSR CSS-only dual-render fetches data once; the two structures do not double-request.

If the project supports Playwright or screenshot tooling, prefer multi-viewport screenshot/smoke verification for responsive changes. If it cannot run, state the exact reason in the handoff.
