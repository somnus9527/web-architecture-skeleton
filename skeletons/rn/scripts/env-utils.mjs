#!/usr/bin/env node
/**
 * Expo 启动/构建脚本共用的环境处理：LAN IP 替换、public 变量过滤与 expo CLI 定位。
 */

import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

/**
 * 取第一个非回环 IPv4 地址。
 *
 * @returns 局域网 IPv4；找不到时返回 127.0.0.1。
 */
export function readLanIp() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return '127.0.0.1';
}

/**
 * 把 API base URL 中的 `__LAN_IP__` 替换为当前局域网地址。
 *
 * @param value - 原始值。
 * @returns 替换后的值。
 */
export function applyLanIp(value) {
  return value.replaceAll('__LAN_IP__', readLanIp());
}

/**
 * 生成 Expo 子进程环境：只保留 EXPO_PUBLIC_* 与运行所需 key，并禁用 CLI 自带 dotenv。
 *
 * @param baseEnv - 父进程环境。
 * @returns 子进程环境。
 */
export function buildExpoEnv(baseEnv = process.env) {
  const env = { ...baseEnv, EXPO_NO_DOTENV: '1' };

  if (env.EXPO_PUBLIC_API_BASE_URL) {
    env.EXPO_PUBLIC_API_BASE_URL = applyLanIp(env.EXPO_PUBLIC_API_BASE_URL);
  }

  return env;
}

/**
 * 定位仓库内的 expo CLI 入口。
 *
 * @param cwd - 项目根目录。
 * @returns expo CLI 入口绝对路径。
 */
export function resolveExpoCli(cwd = process.cwd()) {
  return join(cwd, 'node_modules', 'expo', 'bin', 'cli');
}

/**
 * 读取当前环境标识，用于日志。
 *
 * @returns EXPO_PUBLIC_APP_ENV 或 unknown。
 */
export function readAppEnv() {
  return process.env.EXPO_PUBLIC_APP_ENV ?? 'unknown';
}
