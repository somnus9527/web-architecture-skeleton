import expoConfig from 'eslint-config-expo/flat.js';

/**
 * RN 骨架的 ESLint 基线：沿用 expo 官方 flat config，只收紧命名与禁用项。
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
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
