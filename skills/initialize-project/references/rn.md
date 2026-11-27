# RN

- 生成目录：`<target>`，Expo 项目，名称同时写入 `app.json` 与 `package.json`。
- 初始化参数只有项目名；不涉及后端关系。
- Android/iOS 原生目录不预生成，等上架或原生定制时再 `expo prebuild`。
- 生成的 `.agents/architecture-source.json` 记录仓库、tag、commit。
- 检查入口：`pnpm quality:check`。
