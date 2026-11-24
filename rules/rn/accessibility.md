# 可访问性规则

## 目的

本文件描述 React Native 项目的可访问性硬门禁：a11y 属性必填位置、触控目标、动态字号、屏幕阅读器支持。

## a11y 属性必填位置

### 必填 `accessibilityRole` + `accessibilityLabel`

以下组件必须显式标注 role 与 label：

| 组件                               | accessibilityRole        | accessibilityLabel             | 备注                                  |
| ---------------------------------- | ------------------------ | ------------------------------ | ------------------------------------- |
| `Button`                           | `'button'`               | 显示文本或 children 文本       | UI primitive 已内置默认值             |
| `IconButton`                       | `'button'`               | **必填**（外部传入，描述动作） | 无文本，必须用 label                  |
| `Pressable`（业务可点击行 / 卡片） | `'button'` 或 `'link'`   | 描述目的（如"打开详情"）       |                                       |
| `Switch` / `PaperSwitch`           | `'switch'`               | 描述开关功能                   | 配 `accessibilityState={{ checked }}` |
| `Checkbox` / `Radio`               | `'checkbox'` / `'radio'` | 描述选项                       | 配 `accessibilityState={{ checked }}` |
| `TextInput` / `Input`              | `'text'` 或不设          | label 或 placeholder           | 通过 `accessibilityLabel` 暴露字段名  |
| 列表行（FlatList 内 Pressable）    | `'button'`               | 描述行内容简要                 |                                       |

由 `src/test/architecture/pressable-accessibility-boundary.test.ts` 守护（如未启用，按规则手动审视）。

### Pressable 架构门禁

`src/test/architecture/pressable-accessibility-boundary.test.ts` 扫描 `src/components/**/*.tsx` 中的 `<Pressable>` 与 `<PressableSurface>` 调用。所有自定义可点击 surface 必须在调用节点显式提供 `accessibilityRole` 或 `accessibilityLabel`，其中业务可点击行 / 卡片仍应按上表同时提供 role 与 label；测试只作为最低门槛，避免新可点击入口完全没有屏幕阅读器语义。

首次启用该测试时如命中既有违规，违规清单写入项目本地执行记录；清理违规由后续 slice 逐文件完成，不通过放宽测试绕过。

### 必填 `accessibilityState`

状态变化的控件必须暴露：

```tsx
<Switch
  accessibilityRole="switch"
  accessibilityLabel={t('settings.analytics.label')}
  accessibilityState={{ checked: analyticsEnabled, disabled: !sessionReady }}
  value={analyticsEnabled}
  onValueChange={setAnalyticsEnabled}
/>
```

- 异步动作期间：`accessibilityState={{ busy: true }}`。
- 禁用态：`accessibilityState={{ disabled: true }}`。
- 单选 / 多选：`accessibilityState={{ selected: isSelected }}` 或 `{{ checked }}`。

### 必填 `accessibilityValue`

数值或范围控件：滑动条、量度、价格等动态值。

```tsx
<View
  accessibilityRole="adjustable"
  accessibilityLabel={t('feature.quantity.label')}
  accessibilityValue={{ min: 1, max: 99, now: quantity }}
  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
  onAccessibilityAction={handleAccessibilityAction}
/>
```

## 触控目标

### 最小尺寸

所有可点击元素的触控目标 ≥ 44×44 pt（iOS HIG）/ 48×48 dp（Material）。

```tsx
// 自定义图标按钮
<Pressable
  accessibilityRole="button"
  accessibilityLabel={t('header.search')}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  style={styles.iconButton}
>
  <Search size={20} />
</Pressable>
```

由 `src/test/architecture/icon-button-accessibility.test.ts` 守护。

### 间距

相邻可点击元素之间至少 8 pt 间距，避免误触。

## 动态字号

### 默认开启

`Text` 与 `Input` 默认开启 `allowFontScaling={true}`（RN 默认）；不显式关闭。

### 上限控制

设置 `maxFontSizeMultiplier` 防止大字号下布局崩溃：

```tsx
<Text allowFontScaling maxFontSizeMultiplier={1.4} numberOfLines={2} adjustsFontSizeToFit>
  {title}
</Text>
```

推荐值：

- 标题、按钮文字：`maxFontSizeMultiplier={1.3}`
- 正文、描述：`maxFontSizeMultiplier={1.5}`
- 标签、metric：`maxFontSizeMultiplier={1.2}`

由 `src/test/architecture/small-screen-text-boundary.test.ts` 守护。

### 上限默认值

新增或改造 `Text` / `Input` 时默认按下列上限选择 `maxFontSizeMultiplier`，除非组件已有更严格的小屏文本策略：

- 标题、按钮文字：`1.3`
- 正文、说明文字：`1.5`
- 标签、metric、紧凑导航文字：`1.2`

## 屏幕阅读器

### Heading 标识

页面与区块标题加 `accessibilityRole="header"`：

```tsx
<Text accessibilityRole="header" style={styles.title}>
  {t('feature.title')}
</Text>
```

### 顺序

屏幕阅读器按 JSX 顺序读取；如视觉顺序与 DOM 顺序不一致（绝对定位、`row-reverse` 等），使用 `accessibilityViewIsModal` 或重组 JSX。

### Live Region

异步反馈（toast、错误提示）使用 `accessibilityLiveRegion="polite"`：

```tsx
<View accessibilityLiveRegion="polite" accessibilityRole="alert">
  <Text>{errorMessage}</Text>
</View>
```

### 隐藏装饰

纯装饰图标对屏幕阅读器隐藏：

```tsx
<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  <DecorativeIcon />
</View>
```

## 对比度

- 正文：4.5:1（WCAG AA）。
- 大字号（≥ 18pt regular 或 ≥ 14pt bold）：3:1。
- UI 控件边框、聚焦环：3:1。
- 暗色模式特别注意：浅色文字在深色背景上的对比；token 设计阶段已对齐。

## 焦点管理

- 表单提交失败时焦点滚动到错误字段：
  ```tsx
  inputRefs.current[firstErrorField]?.focus();
  ```
- Modal 打开时焦点进入 modal；关闭后焦点回到打开按钮。
- iOS VoiceOver 与 Android TalkBack 行为基本一致，可一并测试。

## Navigation chrome

- Tab bar 项必须 `accessibilityRole="tab"` + `accessibilityState={{ selected }}`。
- Back button `accessibilityLabel={t('common.back')}`。
- 自定义 header 内所有图标按钮（search、notifications、preferences 等）必须有 a11y label。

## 完成检查

- IconButton / 自定义 Pressable / Switch / Checkbox / Radio 都有 role + label + state。
- 触控目标 ≥ 44pt 或加 hitSlop。
- 文字节点设置 `maxFontSizeMultiplier`。
- 标题加 `accessibilityRole="header"`。
- 异步反馈使用 live region。
- 装饰元素对 a11y 隐藏。
- 颜色对比度满足 WCAG AA。
