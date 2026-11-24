import 'server-only';

/**
 * 后端统一响应信封。成功 `code='200'`、`codeMsg=null`。
 */
export interface IBackendResponseWrapper<T> {
  data: T;
  code: string;
  codeMsg: string | null;
}

/**
 * 单个 showcase 条目的后端 DTO。
 */
export interface IShowcaseItemDTO {
  id: string;
  title: string;
  summary: string;
  category: string;
  updatedAt: string;
}

/**
 * showcase 列表的后端 DTO。
 */
export interface IShowcaseListDTO {
  items: IShowcaseItemDTO[];
  total: number;
}

/**
 * showcase 列表接口的完整响应类型。
 */
export type ShowcaseListResponse = IBackendResponseWrapper<IShowcaseListDTO>;
