import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config，覆盖 TypeScript、React Hooks 和 Vite React refresh 基线。
 */
export default tseslint.config(
  {
    ignores: ['.next', 'build', 'dist', 'coverage', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['*.cjs', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: true } },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/vite-env.d.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
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
);
