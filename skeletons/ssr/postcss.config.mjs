/**
 * Tailwind v4 的 PostCSS 接线。Next.js 通过该插件处理 `globals.css` 里的
 * `@import 'tailwindcss'`；缺少它 Tailwind 将不会被编译（本项目相对基线的修正）。
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
