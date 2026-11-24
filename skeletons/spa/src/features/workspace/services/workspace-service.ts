import type { IOrderQueueQuery, IWorkspaceDashboard, OrderStatus } from '@/features/workspace/types/workspace.types';
import { apiRequest } from '@/shared/tools/api-client';

/**
 * 推进订单状态接口响应。
 */
interface IAdvanceWorkspaceOrderResult {
  /**
   * 后端计算后的下一阶段订单状态。
   */
  status: OrderStatus;
}

/**
 * 获取工作台首屏数据；配置真实 API 后会切换为 endpoint 请求。
 *
 * @param query - 订单队列查询条件。
 * @returns 工作台首屏数据。
 */
export async function getWorkspaceDashboard(query: IOrderQueueQuery): Promise<IWorkspaceDashboard> {
  const response = await apiRequest<IWorkspaceDashboard>('/workspace/dashboard', {
    method: 'POST',
    body: JSON.stringify(query),
  });

  return response.data;
}

/**
 * 推进订单状态；mock 与真实模式都通过 API 契约返回下一状态。
 *
 * @param orderId - 订单唯一标识。
 * @param status - 当前订单履约状态。
 * @returns 下一阶段状态。
 */
export async function advanceOrderStatus(orderId: string, status: OrderStatus): Promise<OrderStatus> {
  const response = await apiRequest<IAdvanceWorkspaceOrderResult>('/workspace/orders/advance', {
    method: 'POST',
    body: JSON.stringify({ orderId, status }),
  });

  return response.data.status;
}
