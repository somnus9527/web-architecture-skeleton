import { serializeJsonLd } from './json-ld-serializer';

/**
 * JSON-LD 结构化数据参数。
 */
export interface IJsonLdProps {
  /**
   * 只允许服务端可控的常量/字典，不得包含用户输入。
   */
  data: unknown;
}

/**
 * 唯一允许内联 JSON-LD 的出口。
 *
 * @param props - JSON-LD 参数。
 * @returns JSON-LD script 节点。
 */
export function JsonLd({ data }: IJsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
