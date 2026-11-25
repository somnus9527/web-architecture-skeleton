/**
 * 把金额格式化为展示字符串。
 *
 * 纯函数、无副作用，client 与未来 server 入口都可安全复用。
 *
 * @param amount - 金额，单位元。
 * @param locale - 语言标签，默认 zh-CN。
 * @returns 带货币符号的展示字符串。
 */
export function formatCurrency(amount: number, locale = 'zh-CN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }).format(amount);
}
