#!/usr/bin/env node
/**
 * 从 .env.<env>.example 生成本地 .env.<env>。
 *
 * 目的：新克隆的仓库不必为了能构建而提交真实 env 文件。
 *
 * 用法：node scripts/init-local-env.mjs <dev|test|prod> [--force]
 */

import { copyFileSync, existsSync } from 'node:fs';
import process from 'node:process';

const ENVIRONMENTS = ['dev', 'test', 'prod'];
const [environment, ...flags] = process.argv.slice(2);

if (!ENVIRONMENTS.includes(environment)) {
  process.stderr.write(`用法: node scripts/init-local-env.mjs <${ENVIRONMENTS.join('|')}> [--force]\n`);
  process.exit(1);
}

const source = `.env.${environment}.example`;
const target = `.env.${environment}`;

if (!existsSync(source)) {
  process.stderr.write(`缺少模板 ${source}，无法生成 ${target}。\n`);
  process.exit(1);
}

if (existsSync(target) && !flags.includes('--force')) {
  process.stdout.write(`${target} 已存在，跳过（使用 --force 覆盖）。\n`);
  process.exit(0);
}

copyFileSync(source, target);
process.stdout.write(`已生成 ${target}；请按本地环境补充实际取值，该文件不会入库。\n`);
