## 共享 UI（SSR 变体）

通用原语之外，SSR 变体额外内置一个需要 Next 路由能力的组件：

| 组件         | 位置                            | 职责                                                       |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| `LinkButton` | `src/shared/ui/link-button.tsx` | 站内链接按钮，统一 `next/link` 跳转、`hreflang` 与按钮样式 |

`LinkButton` 属于 `src/shared/ui/**`，同样受「不许 import `@/features/**`、不许调 `t()`」约束；业务页需要
站内跳转时用它，不要自己拼 `Link` + 原生 `<a>` 或换成裸 `Button` + `router.push`。
