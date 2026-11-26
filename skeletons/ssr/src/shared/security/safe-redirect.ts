function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

/**
 * 只允许站内相对路径的登录/操作回跳。
 *
 * 拒绝：
 * - 绝对 URL、协议相对 URL（`//evil.com`）；
 * - `javascript:` / `data:` / `vbscript:` 等伪协议；
 * - 反斜杠变体、控制字符、空白前缀；
 * - 编码后的 `//` 或反斜杠（最多解码两层）。
 *
 * @param target - 查询参数中的回跳值。
 * @param fallback - 不安全时使用的站内默认路径。
 * @returns 安全的站内相对路径。
 */
export function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target) {
    return fallback;
  }

  const value = target.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  if (hasControlCharacter(value) || value.includes('\\')) {
    return fallback;
  }

  let decoded = value;
  for (let depth = 0; depth < 2; depth += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      return fallback;
    }
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || hasControlCharacter(decoded)) {
    return fallback;
  }

  return value;
}
