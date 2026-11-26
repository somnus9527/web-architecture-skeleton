/**
 * 把 JSON 序列化成可安全放进 `<script>` 的文本。
 *
 * 除标准 JSON 转义外，额外转义 `<`、`>`、`&`、U+2028、U+2029，
 * 防止 `</script>` 或行分隔符逃逸。
 *
 * @param data - 结构化数据。
 * @returns 可内联的 JSON 文本。
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}
