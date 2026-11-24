import { cpSync, existsSync } from 'node:fs';

/**
 * 将 standalone 默认不打入的静态资源拷进自包含目录，满足无 CDN 部署形态。
 */
const assetPairs = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

for (const [from, to] of assetPairs) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
  }
}
