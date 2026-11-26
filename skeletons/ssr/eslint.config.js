import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * ESLint flat config：覆盖 Next.js App Router、TypeScript、React 与项目命名基线。
 * lint 范围为整个仓库（含 scripts 与根配置），非仅 src——保证维护脚本也受约束。
 */
export default tseslint.config(
  {
    ignores: ['.next', 'coverage', 'node_modules', 'out', 'output', 'dist', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      import: importPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // eslint-plugin-import 2.x 与 ESLint 10 的 SourceCode API 不兼容（getTokenOrCommentAfter），
      // 这里关闭 import/order，避免 lint 直接崩溃；导入顺序由评审和 Prettier 保证。
      'import/order': 'off',
      'no-console': 'error',
      // 命名规范：interface 必带 I 前缀；type alias / enum 用 PascalCase。
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^(I[A-Z]|BreakpointOverrides$)', match: true },
        },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
      ],
    },
  },
  {
    // 维护脚本与根配置（.mjs/.cjs）：Node 环境，允许 console。
    files: ['scripts/**/*.{mjs,cjs,js}', '*.config.{mjs,cjs,js}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/shared/logger/**/*.ts', 'src/bff/shared/logger/**/*.ts'],
    rules: {
      // logger 是唯一允许触达 console transport 的基础设施层；业务代码仍禁止直接调用 console。
      'no-console': 'off',
    },
  },
  jsxA11y.flatConfigs.recommended,
  {
    // UI 边界（UI-001/UI-002）：业务层只能走 @/shared/ui。
    // 判定与 scripts/check-ui-boundary.mjs 保持一致：脚本兜底 CI，这里给编辑器即时反馈。
    files: ['src/{features,app,router}/**/*.{ts,tsx}'],
    ignores: [
      'src/app/global-error.tsx',
      'src/app/error.tsx',
      'src/app/providers.tsx',
      'src/app/providers/**',
      'src/test/**',
      '**/*.test.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'antd', message: 'UI-002 业务层禁止直引 antd，请从 @/shared/ui 导入' },
            { name: 'lucide-react', message: 'UI-002 图标请从 @/shared/ui 导入' },
          ],
          patterns: [
            {
              group: ['antd/*', '@ant-design/icons', '@ant-design/icons/*', '@ant-design/nextjs-registry'],
              message: 'UI-002 业务层禁止直引 antd 生态包，请从 @/shared/ui 导入',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...['button', 'input', 'select', 'textarea', 'dialog', 'table'].map((tag) => ({
          selector: `JSXOpeningElement[name.name='${tag}']`,
          message: `UI-001 业务层禁止原生 <${tag}>，请使用 @/shared/ui 的原语`,
        })),
      ],
    },
  },
  // eslint-config-prettier 放最后：关掉与 Prettier 冲突的格式化规则，格式化交给 Prettier。
  eslintConfigPrettier,
);
