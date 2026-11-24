/**
 * commit message 校验(宽松档):沿用 config-conventional 的解析器,但只保留"前缀"约束。
 * 只要以下列 type 前缀之一开头即可(如 `feat: xxx`、`bugfix: xxx`);
 * scope、大小写、句号、长度等一律不校验。
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'bugfix', 'docs', 'chore', 'refactor', 'test', 'style', 'perf', 'ci', 'build', 'revert'],
    ],
    'type-empty': [2, 'never'],
    // 关掉其余严格规则,只认前缀。
    'type-case': [0],
    'scope-empty': [0],
    'scope-case': [0],
    'subject-empty': [0],
    'subject-case': [0],
    'subject-full-stop': [0],
    'header-max-length': [0],
    'body-leading-blank': [0],
    'body-max-line-length': [0],
    'footer-leading-blank': [0],
    'footer-max-line-length': [0],
  },
};
