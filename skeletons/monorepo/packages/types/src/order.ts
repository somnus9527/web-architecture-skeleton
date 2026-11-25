/**
 * 订单状态。跨 app 共享的稳定业务语义，取值必须与 API 契约保持一致。
 */
export type OrderStatus = 'pending' | 'active' | 'done';

/**
 * 订单视图模型。
 */
export interface IOrder {
  /**
   * 订单 id。
   */
  id: string;
  /**
   * 订单标题。
   */
  title: string;
  /**
   * 订单状态。
   */
  status: OrderStatus;
}
