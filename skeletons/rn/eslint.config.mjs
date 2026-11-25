import expoConfig from 'eslint-config-expo/flat.js';

/**
 * 架构边界：业务代码禁止直接使用 Paper / 平台 storage，跨目录 import 必须用无斜杠 alias。
 */
const RESTRICTED_IMPORT_PATTERNS = [
  { group: ['../*'], message: '跨目录 import 使用 @app / @api / @components 等 alias，禁止 ../../。' },
  {
    group: ['@/api/*', '@/components/*', '@/domain/*', '@/storage/*', '@/theme/*', '@/test/*', '@/app/*'],
    message: '使用无斜杠 alias（@api/*、@components/* 等）；@/* 仅作兜底。',
  },
];

const RESTRICTED_IMPORT_PATHS = [
  { name: 'react-native-paper', message: '业务代码使用 @components/ui wrapper，不直接 import Paper。' },
  { name: 'expo-secure-store', message: '使用 src/storage/* wrapper。' },
  { name: '@react-native-async-storage/async-storage', message: '使用 src/storage/* wrapper。' },
];

const PAPER_BOUNDARY_FILES = [
  'src/components/ui/paper-controls.tsx',
  'src/components/providers/paper-theme-provider.tsx',
  'src/theme/paper-theme.ts',
];

/**
 * RN 骨架的 ESLint 基线：沿用 expo 官方 flat config，并补齐规则要求的边界与 import 顺序。
 */
export default [
  ...expoConfig,
  { ignores: ['node_modules', '.expo', 'dist', 'android', 'ios'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: true } },
        { selector: 'typeAlias', format: ['PascalCase'] },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', { patterns: RESTRICTED_IMPORT_PATTERNS, paths: RESTRICTED_IMPORT_PATHS }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@(app|api|components|domain|storage|theme|test)/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['src/api/logger.ts', 'src/test/**/*.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
  {
    files: PAPER_BOUNDARY_FILES,
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/storage/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
