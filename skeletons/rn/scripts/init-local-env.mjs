#!/usr/bin/env node
/**
 * 从 `env/.env.<environment>.example` 生成 `env/.env.<environment>`。
 *
 * 目的：新克隆的仓库不必为了能跑起来而提交真实 env 文件；模板入库，取值留在本地。
 *
 * 用法：pnpm env:init <dev|test|prod|staging|mock> [--force]
 *   dev  → development
 *   prod → production
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ENV_DIRECTORY = 'env';
const REQUIRED_KEYS = ['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_API_BASE_URL'];

/**
 * 允许的环境别名，对齐 `docs/rules/rn/release.md` 的 env file 列表。
 */
const ENVIRONMENT_ALIASES = new Map([
  ['dev', 'development'],
  ['development', 'development'],
  ['staging', 'staging'],
  ['test', 'test'],
  ['prod', 'production'],
  ['production', 'production'],
  ['mock', 'mock'],
]);

const [argument, ...flags] = process.argv.slice(2);
const environment = argument ? ENVIRONMENT_ALIASES.get(argument) : undefined;

if (!environment) {
  process.stderr.write(`用法: pnpm env:init <${[...ENVIRONMENT_ALIASES.keys()].join('|')}> [--force]\n`);
  process.exit(1);
}

const source = join(ENV_DIRECTORY, `.env.${environment}.example`);
const target = join(ENV_DIRECTORY, `.env.${environment}`);

if (!existsSync(source)) {
  process.stderr.write(`缺少模板 ${source}，无法生成 ${target}。\n`);
  process.exit(1);
}

const template = readFileSync(source, 'utf8');
const missingKeys = REQUIRED_KEYS.filter((key) => !new RegExp(`^${key}=`, 'mu').test(template));
if (missingKeys.length > 0) {
  process.stderr.write(`${source} 缺少必填项: ${missingKeys.join(', ')}\n`);
  process.exit(1);
}

if (existsSync(target) && !flags.includes('--force')) {
  process.stdout.write(`${target} 已存在，跳过（使用 --force 覆盖）。\n`);
  process.exit(0);
}

mkdirSync(ENV_DIRECTORY, { recursive: true });
copyFileSync(source, target);
process.stdout.write(`已生成 ${target}；请按本地环境补充实际取值，该文件不会入库。\n`);
