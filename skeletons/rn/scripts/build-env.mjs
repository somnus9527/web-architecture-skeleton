#!/usr/bin/env node
/**
 * 本地构建入口：在已由 `node --env-file` 注入的环境下执行 expo export。
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

import { buildExpoEnv, readAppEnv, resolveExpoCli } from './env-utils.mjs';

const forwardedArgs = process.argv.slice(2);
const expoCli = resolveExpoCli();

process.stdout.write(`Building Expo bundle (${readAppEnv()})...\n`);

const child = spawn(
  process.execPath,
  [expoCli, 'export', '--platform', 'all', '--output-dir', 'dist', ...forwardedArgs],
  {
    env: buildExpoEnv(),
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
