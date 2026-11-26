# 动画

所有 UI 动画的硬约束。核心原则:**动画交给浏览器合成层跑,不要交给框架的渲染线程跑。** 适用于 React SPA 与 Next.js SSR。

配合阅读 [`frontend-react.md`](./frontend-react.md) 与
[`native-css-and-tokens.md`](./native-css-and-tokens.md)。

## 硬性禁令(TL;DR)

1. **只动合成层属性**:动画只改 `transform` 和 `opacity`;**绝不在动画里改触发布局/重排的属性**(`width`/`height`/`top`/`left`/`right`/`bottom`/`margin`/`padding`/`font-size` 等)。位移用 `translate`、缩放用 `scale`、旋转用 `rotate`。
2. **禁止用状态*逐帧驱动*动画**:不允许在 `requestAnimationFrame` / 定时器 / 循环 / `scroll` / `drag` / `mousemove` / `resize` 等回调里,用 `setState` / signal / store 写入来**逐帧改动画数值**并触发重渲染。这条是本规范的重点,也是最常见的反模式。
3. **优先声明式 CSS**:简单状态切换用 CSS `transition`,复杂/循环/多步用 `@keyframes`。
4. **JS 读 DOM 再做的动画要先确认**:凡是必须用 JS 读取不确定的 DOM 位置/尺寸才能实现的动画(见下「需要 JS 测量的场景」),**先提出来确认这个动画是否真的要做、并说明实现方式,确认后才允许**。

## 允许 vs 禁止(把边界说死)

**✅ 允许:状态只当"触发器",动画由 CSS 跑**

```tsx
// state/props 一次性切 class 或 data-属性 → CSS transition/@keyframes 负责动
<div className={isOpen ? 'panel panelOpen' : 'panel'} />
// .panel { transition: transform .2s ease, opacity .2s ease }
// .panelOpen { transform: translateX(0); opacity: 1 }
```

**❌ 禁止:状态承载动画的每一帧数值,逐帧重渲染**

```tsx
// rAF → setState 逐帧
useEffect(() => {
  const tick = () => { setX((x) => x + 2); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
}, []);
// 滚动/拖拽回调 → setState 驱动位移
onScroll={() => setOffset(window.scrollY)}
```

区别只有一个:**状态变化是"开关"(允许)还是"每一帧的值"(禁止)。**

## 需要 JS 测量的场景(先确认,且用正确逃生舱)

有些动画**本来就合法依赖 JS 读取 DOM**,不必回避,但**必须先确认**再做:FLIP(高性能布局位移)、共享元素 / hero 过渡、`height:auto` 展开收起、拖拽跟手、canvas/WebGL、SVG 路径跟随。

即便用 JS 测量,**动画数值也不许走 setState 逐帧**,而是走命令式、绕开框架渲染:

- **正确逃生舱**:`ref.current.style.transform = ...`(命令式直写)、或 **Web Animations API `element.animate(...)`**。这些都在框架渲染线之外。
- **反模式**:`rAF → setState` / `measure → setState 每帧`。

```tsx
// ✅ 测量后命令式驱动,不经 React state
const el = ref.current;
const first = el.getBoundingClientRect();
// ...布局变化...
const last = el.getBoundingClientRect();
el.animate([{ transform: `translate(${first.x - last.x}px, ${first.y - last.y}px)` }, { transform: 'none' }], {
  duration: 200,
  easing: 'ease',
});
```

> 确认流程:在动手前一句话说明「要做什么动画 / 为什么必须 JS 测量 / 用哪种逃生舱」,拿到确认再写。默认倾向是**不做**或降级为纯 CSS 版本。

## 复杂动画的工具选择(都在渲染线之外)

- 简单状态切换 → CSS `transition`。
- 循环 / 多步 / 关键帧 → CSS `@keyframes`(SVG 里可用 SMIL `<animate>`,如连线流光效果)。
- 需要 JS 编排的复杂序列 → **Web Animations API**(`element.animate`),而非 setState。
- 路由/视图切换的整体过渡 → **View Transitions API**(可用时)。

## 无障碍与性能

- **必须尊重 `@media (prefers-reduced-motion: reduce)`**:在该媒体查询下关闭或大幅弱化非必要动画。
- **`will-change` 慎用**:只在动画即将发生时短暂加、结束后移除,不要常驻(常驻会白占合成层内存)。
- 动画元素避免触发布局:不要在动画期间读写会引起同步布局(layout thrashing)的属性。

## 验证

- 动画期间开 DevTools Performance / Rendering:确认没有逐帧的 React commit,没有 "Layout"/"Recalculate Style" 抖动;掉帧检查(接近 60fps)。
- 搜代码里的反模式:`requestAnimationFrame` / `onScroll` / `onMouseMove` 回调内是否有 `setState` / store set 驱动样式值。
- `prefers-reduced-motion: reduce` 下动画按规范弱化。
