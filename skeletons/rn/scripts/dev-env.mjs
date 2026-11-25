#!/usr/bin/env node
/**
 * 本地开发入口：在已由 `node --env-file` 注入的环境下启动 Expo，支持 `--lan`。
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

import { buildExpoEnv, readAppEnv, resolveExpoCli } from './env-utils.mjs';

const forwardedArgs = process.argv.slice(2);
const expoCli = resolveExpoCli();

process.stdout.write(`Starting Expo (${readAppEnv()})...\n`);

const child = spawn(process.execPath, [expoCli, 'start', ...forwardedArgs], {
  env: buildExpoEnv(),
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
