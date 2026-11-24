# Tailwind V4 System

## MUI Boundary

- New React projects default to MUI for interaction components and theme ownership.
- Tailwind v4 is optional utility styling, layout support, or legacy-template compatibility; it is not the primary component system for new projects.
- Do not recreate MUI components with Tailwind in new projects when MUI already provides the interaction and accessibility behavior.
- If an existing or rebuilt project is Tailwind/custom-CSS first, evaluate whether MUI can be introduced into pre-existing surfaces without visual or interaction regression. If parity is difficult, keep the existing styling system for those surfaces and document the compatible exception. Newly developed capabilities still default to MUI-first.

## Setup And Tokens

> 标准 Tailwind v4 CSS-first 配置(`@import "tailwindcss"`、`@theme` 语义 token、OKLCH 色彩、`@custom-variant` 暗色模式、CVA/`cn()` 取舍、`tailwind.config.ts` 迁移)按官方文档执行,本文不重复。

项目专属约束:

- 圆角默认 <=8px,除非品牌方向另有要求(与 [`./frontend-react.md`](./frontend-react.md) UI 方向一致)。
- 断点不用 Tailwind 默认 `sm/md/lg/xl/2xl`;命名断点与 MUI 单一来源见 [`./responsive-and-breakpoints.md`](./responsive-and-breakpoints.md)。4K/2K 长度缩放走 `app-scale`,不加额外断点。
