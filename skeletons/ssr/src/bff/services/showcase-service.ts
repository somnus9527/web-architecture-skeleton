import 'server-only';

import { adaptShowcaseList, type IShowcaseListViewModel } from '../adapter/showcase-adapter';
import { fetchShowcaseList, ShowcaseGatewayError } from '../gateway/showcase-gateway';

import { serverLogger } from '@/bff/shared/logger/server-logger';
import type { IRequestContext } from '@/bff/shared/request-context';

/**
 * 编排 showcase 列表用例：出站取数 → 适配为展示模型。
 *
 * 依赖等级：showcase 列表为 **required**（失败即让 route facade 归一为错误响应，不静默降级）。
 * 若为 degradable 依赖，应在此处局部 try-catch 并返回降级视图 + 记 degradation 日志。
 *
 * @param context - 请求上下文。
 * @returns showcase 列表展示模型。
 */
export async function getShowcaseListService(context: IRequestContext): Promise<IShowcaseListViewModel> {
  const dto = await fetchShowcaseList(context);
  const viewModel = adaptShowcaseList(dto);

  serverLogger.info('showcase-list service resolved', {
    requestId: context.requestId,
    routeId: 'service:showcase-list',
    fields: { dependency: 'required', total: viewModel.total },
  });

  return viewModel;
}

/**
 * 首页公开展示用 showcase 列表。骨架 showcase 是可降级内容，真实 dev 后端未实现该示例契约时返回稳定空态。
 *
 * @param context - 请求上下文。
 * @returns showcase 列表展示模型。
 */
export async function getShowcaseListForHomeService(context: IRequestContext): Promise<IShowcaseListViewModel> {
  try {
    return await getShowcaseListService(context);
  } catch (error) {
    if (!(error instanceof ShowcaseGatewayError)) {
      throw error;
    }

    const fallbackViewModel = adaptShowcaseList({ items: [], total: 0 });
    serverLogger.warn('showcase-list home dependency degraded', {
      requestId: context.requestId,
      routeId: 'service:showcase-list',
      fields: { code: error.code, status: error.status },
    });

    return fallbackViewModel;
  }
}
