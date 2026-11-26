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

/**
 * 跳到站内相对路径，是客户端执行重定向的唯一出口。
 *
 * 先经 `safeRedirect()` 收敛成站内路径，再执行跳转；服务端渲染时不做任何跳转，返回 null 让调用方
 * 自己决定是否继续。用 `replace()` 而不是 `assign()`：登录跳转不该留在回退栈里。
 *
 * @param target - 期望跳转目标（可能来自查询参数）。
 * @param fallback - 目标不安全时使用的站内默认路径。
 * @returns 实际跳转的站内路径；非浏览器环境返回 null。
 */
export function redirectToInternalPath(target: string | null | undefined, fallback: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const safePath = safeRedirect(target, fallback);
  window.location.replace(safePath);

  return safePath;
}
