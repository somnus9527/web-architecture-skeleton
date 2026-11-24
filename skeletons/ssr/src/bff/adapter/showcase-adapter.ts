import 'server-only';

import type { IShowcaseItemDTO, IShowcaseListDTO } from '../dto/showcase-dto';

/**
 * 客户端可序列化的单个 showcase 展示模型。
 */
export interface IShowcaseItemViewModel {
  id: string;
  title: string;
  summary: string;
  category: string;
  /**
   * 已格式化的更新时间展示串（adapter 负责把 ISO 时间转为展示文案）。
   */
  updatedLabel: string;
}

/**
 * 客户端可序列化的 showcase 列表展示模型。
 */
export interface IShowcaseListViewModel {
  items: IShowcaseItemViewModel[];
  total: number;
  isEmpty: boolean;
}

/**
 * 把单个 showcase DTO 映射为展示模型。纯函数，无副作用。
 *
 * @param dto - 后端条目 DTO。
 * @returns 展示模型。
 */
function adaptShowcaseItem(dto: IShowcaseItemDTO): IShowcaseItemViewModel {
  return {
    id: dto.id,
    title: dto.title,
    summary: dto.summary,
    category: dto.category,
    updatedLabel: new Date(dto.updatedAt).toISOString().slice(0, 10),
  };
}

/**
 * 把 showcase 列表 DTO 映射为展示模型。纯函数：不发请求、不读 cookie/headers/env、不 revalidate。
 *
 * @param dto - 后端列表 DTO。
 * @returns 展示模型。
 */
export function adaptShowcaseList(dto: IShowcaseListDTO): IShowcaseListViewModel {
  const items = dto.items.map(adaptShowcaseItem);

  return {
    items,
    total: dto.total,
    isEmpty: items.length === 0,
  };
}
