# UI 组件规则

## 目的

本文件描述 React Native 项目的 UI primitive 使用、底层 UI 库（React Native Paper）边界、列表虚拟化与触控质量规则。

## UI primitive 库

项目使用基于 React Native Paper 的自有 UI primitive 库，位于 `src/components/ui/*`。业务代码**只**使用 UI primitive，不直接使用 RN 或 Paper 原始组件。

### 标准 UI primitive 清单

| Primitive                                                                                 | 用途                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Button`                                                                                  | 主操作按钮，支持 variant / loading / disabled                     |
| `IconButton`                                                                              | 图标按钮，必须 accessibilityLabel                                 |
| `Card`                                                                                    | 卡片容器，统一圆角与阴影                                          |
| `Input`                                                                                   | 文本输入框 wrapper                                                |
| `SearchField`                                                                             | 搜索输入                                                          |
| `SectionHeader`                                                                           | 区块标题（title + description）                                   |
| `ThemeToggle`                                                                             | 明暗主题切换（亮/暗/跟随系统循环，必须传 accessibilityLabel）     |
| `Skeleton`                                                                                | 骨架屏                                                            |
| `EmptyState`                                                                              | 空态 / 错误态，含 context（`list` / `detail` / `form` / `error`） |
| `Badge`                                                                                   | 徽章                                                              |
| `Price`                                                                                   | 价格展示，内部处理币种格式化（仅面向有价格展示的 App）            |
| `MediaBadge`                                                                              | 图片、图标或短标签徽章                                            |
| `PressableSurface`                                                                        | 可按压面，统一按压反馈                                            |
| `ModalScreenFrame` / `SubpageScreenFrame`                                                 | screen 外壳，处理 safe area                                       |
| `SheetModal`                                                                              | bottom sheet modal                                                |
| `PaperControls`（含 `PaperSwitch` / `PaperCheckbox` / `PaperRadio` / `PaperSnackbar` 等） | Paper 组件 wrapper                                                |

模版见 `docs/rules/rn/templates/ui-primitive.md`。

### 新增 primitive 准入条件

- 同一形态被两个以上 feature 使用。
- 无业务语义（不依赖 `domain/*`）。
- 通过 token 消费主题，不写死颜色。
- 暴露 `testID` prop。
- 含 a11y 默认值（`accessibilityRole`、`accessibilityLabel` 必填或继承自 children）。

## React Native Paper 边界

### 业务代码禁止直接 import

业务代码（`src/components/<feature>/*`、`src/domain/*`、`app/*`）**禁止**：

```ts
// 禁止
import { Button, Switch, useTheme } from 'react-native-paper';
```

### Paper 允许出现位置

- `src/components/ui/paper-controls.tsx`：Paper 组件的 wrapper。
- `src/components/providers/paper-theme-provider.tsx`：PaperProvider 挂载。
- `src/theme/paper-theme.ts`：项目 token → Paper MD3 theme 映射。

由 `src/test/architecture/paper-boundary.test.ts`（或等价测试）守护。

### 何时引入新 Paper 组件

- 需要 RN 原生不提供的复杂组件（Snackbar、Menu、Dialog、Banner 等）。
- 在 `src/components/ui/paper-controls.tsx` 中导出 wrapper，应用项目 token 与 a11y 默认值。
- 业务代码使用 wrapper，不直接 import Paper。

## 长列表虚拟化

### 业务长列表清单

以下场景必须使用 `FlatList` 或 `SectionList`，不允许 `.map` 直接在 JSX 中渲染列表项。公司规范不维护某个 App 的实际 source 清单；每个项目应在本地架构测试 registry 或执行记录中登记需要守护的长列表 source。

| 场景类型                         | 列表数据来源                           |
| -------------------------------- | -------------------------------------- |
| 远端 query 返回的可变长度列表    | `query.data.items`、分页结果、搜索结果 |
| 用户生成或可持续增长的本地列表   | 收藏、草稿、历史记录、通知             |
| 分组列表                         | sections、categories、grouped items    |
| 详情页中的评论 / 评价 / 相关内容 | reviews、related items、activity logs  |

### 性能常量

复用 `@components/ui/flat-list-performance`：

```ts
export const LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT = 6;
export const LOW_END_FLAT_LIST_MAX_BATCH_COUNT = 6;
export const LOW_END_FLAT_LIST_BATCHING_PERIOD_MS = 64;
export const LOW_END_FLAT_LIST_WINDOW_SIZE = 7;
```

FlatList 标准用法：

```tsx
<FlatList
  data={items}
  initialNumToRender={LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT}
  maxToRenderPerBatch={LOW_END_FLAT_LIST_MAX_BATCH_COUNT}
  updateCellsBatchingPeriod={LOW_END_FLAT_LIST_BATCHING_PERIOD_MS}
  windowSize={LOW_END_FLAT_LIST_WINDOW_SIZE}
  removeClippedSubviews
  keyExtractor={(item) => item.id}
  renderItem={renderListItem}
  ListEmptyComponent={<EmptyState ... />}
  ListHeaderComponent={<SectionHeader ... />}
  testID="feature-list"
/>
```

完整模版见 `docs/rules/rn/templates/screen-with-flatlist.md`。

### renderItem 引用稳定

- `renderItem` 必须是稳定引用：定义在 component 外或用 `useCallback`。
- 列表项组件用 `React.memo` 包裹，避免父组件 re-render 触发整列重绘。
- 详见 `docs/rules/rn/performance.md`。

### 静态短列表豁免

不超过 10 项的**静态**数据（如 nav tabs、card meta rows、icon row）可以保留 `.map` 渲染：

```tsx
{
  ['1', '2', '3'].map((step) => <Step key={step} number={step} />);
}
```

判断标准：项数不会随 query / 用户输入变化，渲染开销可忽略。

可保留 `.map` 的典型例子：

- 固定筛选或导航配置，例如 tab routes、静态 filter options。
- 单张卡片内部的固定字段行或标签，例如 summary rows、rating stars、短标签。
- 非 JSX 渲染的数据派生，例如 `useMemo` 中把报价、优惠券或本地化内容转换成 option / lookup。

## 触控与按钮

### 异步动作必须暴露状态

会触发异步工作的 Button 与 IconButton 必须暴露 `loading` 或 `disabled` 状态，避免重复提交：

```tsx
<Button label={t('form.submit')} loading={submitMutation.isPending} disabled={!isFormValid} onPress={handleSubmit} />
```

由 `src/test/architecture/button-action-state-boundary.test.ts` 守护。

### 触控目标

- 最小触控目标 ≥ 44×44 pt。
- `Pressable` 内部内容小于该尺寸时，加 `hitSlop`：
  ```tsx
  <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} ... />
  ```

### Pressed 视觉反馈

- 所有 `Pressable` 必须有 pressed 反馈：opacity / scale / 背景色变化。
- 使用 `PressableSurface` 统一反馈逻辑：
  ```tsx
  <PressableSurface onPress={...}>
    <View>...</View>
  </PressableSurface>
  ```

## Modal / Sheet

- Modal 与 sheet 必须使用 `ModalScreenFrame` 或 `SheetModal` wrapper。
- 必须处理 safe area（top / bottom inset）。
- 必须可关闭：iOS swipe down、Android 硬件 back、关闭按钮。
- 由 `src/test/architecture/modal-sheet-safe-area-boundary.test.ts` 守护。

## 文字与小屏

- Text 节点必须 `adjustsFontSizeToFit` + `numberOfLines` 在标题、metric 区与按钮上启用。
- 长文本使用 `numberOfLines={2}` + `ellipsizeMode="tail"`。
- 详见 `docs/rules/rn/accessibility.md`。

## 图片

业务图片必须通过 `@components/ui/image` 接入 `expo-image`，不直接使用 RN `Image`。详见 `docs/rules/rn/images.md`。

## 完成检查

- 业务代码不直接 import `react-native-paper`。
- 业务长列表使用 FlatList + 性能常量，不出现 `.map` 直接渲染列表项。
- 异步按钮暴露 loading / disabled。
- Pressable 触控目标 ≥ 44pt 或加 hitSlop。
- Modal / sheet 处理 safe area。
- 文字节点处理 dynamic font sizing。
