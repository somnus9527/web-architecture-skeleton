# 组件拆分规则

## 目的

本文件描述 React Native 项目的组件拆分、screen 编排与同目录辅助文件组织规则。

## 通用原则

- 组件和方法必须遵守单一职责。
- Screen 组件是**编排层**：负责组装区块、连接页面级状态，并调用 domain / hook。
- Screen 组件不应长期承载大量纯逻辑、大型映射表、API 请求构造、状态格式化或可复用业务计算。
- 拆分应服务于可读性、可维护性和可测试性。不要拆出空壳组件，也不要让多个职责持续堆在同一个文件中。

## 文件大小阈值

| 行数    | 处理                                                   |
| ------- | ------------------------------------------------------ |
| ≤ 300   | 健康。                                                 |
| 301–450 | 进入警示。下次触达该文件时主动评估拆分。               |
| 451–500 | 必须在 PR 描述中给出"为何不拆"或承诺下个 sprint 拆分。 |
| > 500   | 必须立即拆分；不允许在同一文件继续叠加新业务区块。     |

阈值由 `src/test/architecture/file-split-boundary.test.ts` 守护。
达到或超过 500 行的 `src/components/**/*.tsx` 文件，必须在项目本地执行记录或债务清单中登记 owner、原因和下一步计划；未登记应触发架构测试失败。已经登记的文件仍应在后续触达时优先按同目录拆分锚点收敛，不得继续叠加新职责。

## 同目录拆分锚点

当 screen 文件接近阈值时，按以下顺序抽取到**同目录**辅助文件：

| 文件                        | 内容                                  | 示例                        |
| --------------------------- | ------------------------------------- | --------------------------- |
| `<screen>-screen.tools.ts`  | 纯方法、映射、格式化、参数归一化      | `register-screen.tools.ts`  |
| `<screen>-screen.config.ts` | 静态展示配置、文案 key 表、字段顺序表 | `register-screen.config.ts` |
| `<screen>-screen.types.ts`  | 共享局部类型（仅本 screen 使用）      | `register-screen.types.ts`  |
| `use-<feature>.ts`          | 状态派生、副作用编排、可复用 hook     | `use-register-form.ts`      |
| `<screen>-<section>.tsx`    | 业务子组件、区块                      | `register-form-section.tsx` |

当同目录 helper 继续增长时，可以使用同目录子目录：`tools/`、`hooks/`、`config/`、`types/`；只有在能改善 import 时才增加 `index.ts`。

## 拆分示范

复杂表单或复杂详情页应采用同目录拆分：主 screen 只保留 route params、KeyboardAvoidingView / ScrollView 编排和成功回调；表单状态与提交流程放在 `use-<feature>-form.ts`；字段校验和 query 单值读取放在 `<screen>-screen.tools.ts`；静态 testID、i18n key 和输入配置放在 `<screen>-screen.config.ts`；注入服务、hook controller 和 props 放在 `<screen>-screen.types.ts`；主体 UI 放在 `<screen>-<section>.tsx`。完整示例见 `docs/rules/rn/templates/form-screen.md`。

## 拆分触发条件

出现以下情况时，主动评估拆分：

- 一个文件混合了布局、请求状态、映射、格式化、配置和类型声明。
- 一个 render 树包含三个或更多清晰的业务区块。
- 一个方法包含多个阶段或多层嵌套条件。
- 相似的映射或格式化逻辑出现在多个 screen 中。
- 文件接近 500 行警示线。

## 抽取优先级

1. 业务区块 → 子组件（同目录 `<screen>-<section>.tsx`）。
2. 可复用状态或副作用流程 → hook（同目录 `use-<name>.ts`）或 `src/domain/<area>/use-<name>.ts`。
3. 纯映射、格式化或计算 → `<screen>-screen.tools.ts` 或 `src/domain/<area>/<helper>.ts`。
4. 展示常量 → `<screen>-screen.config.ts`。
5. 类型声明 → `<screen>-screen.types.ts`。
6. 跨 feature 复用 → 根据职责放入 `src/domain/*` 或 `src/components/ui/*`。

## 动态区块

- 条件分支切换的是完整且相对独立的内容区块 → 抽成独立组件。
- 条件只切换一两个简单元素 → 保留在当前组件内联渲染。
- 条件分支内部包含自己的交互、状态或映射逻辑 → 再次评估抽取。

## 方法拆分

- 方法应尽量只做一件事。
- 当方法变得难以扫描时，拆分参数归一化、核心计算、错误处理、副作用和状态写入。
- 事件处理函数应委托业务计算和 API / domain 调用，不要把完整流程都塞进 handler。

## Screen 标准结构

按下序组织 screen 文件：

```tsx
// 1. import（外部包 → @xxx → ./xxx）
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { getItemDetail } from "@api/endpoints/<feature>";
import { useThemeTokens } from "@theme/theme-provider";
import { Card } from "@components/ui/card";
import { ItemDetailSection } from "./item-detail-section";

// 2. 类型声明（少量；多了迁到 .types.ts）
interface IItemDetailScreenProps {
  id: string;
}

// 3. 路由 / 数据加载 helper（少量；多了迁到 .tools.ts）
async function loadItemDetail(id: string) {
  return await getItemDetail(id);
}

// 4. 主组件
export function ItemDetailScreen({ id }: IItemDetailScreenProps) {
  // 4.1 hook
  const tokens = useThemeTokens();
  const { t } = useTranslation();

  // 4.2 query / store
  const detailQuery = useQuery({ ... });

  // 4.3 派生数据
  const detailModel = useMemo(() => ..., [detailQuery.data]);

  // 4.4 handler
  const handleSelectPlan = useCallback(() => ..., []);

  // 4.5 渲染分支：loading / error / empty / 主内容
  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError) return <ErrorState />;
  return ( ... );
}

// 5. 子组件（少量；多了拆到独立文件）
function ItemDetailHeader({ ... }) { ... }

// 6. StyleSheet
const styles = StyleSheet.create({ ... });
```

## 业务 query 必填三态

由 React Query 驱动的 screen 与 panel 必须显式处理：

- **loading**：渲染 `Skeleton` 或 placeholder。
- **error**：渲染 `EmptyState context="error"` 或专用错误态。
- **empty**：query 成功但数据为空，渲染 `EmptyState`。

具体见 `docs/rules/rn/error-handling.md`。

## 长列表必须虚拟化

业务长列表必须使用 `FlatList` / `SectionList` 并复用 `@components/ui/flat-list-performance` 常量；不允许 `.map` 直接在 JSX 中渲染列表项。详见 `docs/rules/rn/ui-components.md`。

## React Native 特有规则

- 异步动作必须暴露 loading / disabled 状态，避免重复提交。
- Modal / sheet safe area、Android back 行为、小屏文字和触控区域都是组件质量的一部分。详见 `docs/rules/rn/accessibility.md` 与 `docs/rules/rn/forms-keyboard.md`。
- 业务组件不允许直接 import `react-native-paper`；必须使用 `src/components/ui/*` wrapper。详见 `docs/rules/rn/ui-components.md`。

## 完成检查

- 主文件 ≤ 450 行（最好 ≤ 300）；超出需要给出原因。
- 同目录 `.tools.ts` / `.config.ts` / `.types.ts` / `use-*.ts` 出现频率合理；不是把所有东西塞主文件。
- 业务区块拆成子组件而不是嵌套 600 行 render 树。
- loading / empty / error 三态显式处理。
