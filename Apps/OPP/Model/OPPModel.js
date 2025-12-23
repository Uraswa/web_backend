import BasicPPOModel from '../../../Core/Model/BasicPPOModel.js';
import BasicOrderModel from '../../../Core/Model/BasicOrderModel.js';
import { Database } from '../../../Core/Model/Database.js';
import ordersService from '../../../Core/Services/ordersService.js';
import OuterLogisticsService from '../../../Core/Services/outerLogisticsService.js';

class OPPModel extends BasicPPOModel {
  _firstPhoto(photos) {
    if (!photos) return '';

    if (Array.isArray(photos)) {
      return photos[0] || '';
    }

    if (typeof photos === 'string') {
      const trimmed = photos.trim();
      if (!trimmed) return '';

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed[0] || '';
        }
      } catch {
        // ignore
      }

      return trimmed;
    }

    return '';
  }

  /**
   * Получить заказы для конкретного ПВЗ
   * Использует готовый метод BasicOrderModel.findByOppId()
   * @param {number} oppId - ID ПВЗ
   * @param {object} filters - фильтры (status)
   * @returns {Promise<Array>} - массив заказов с деталями
   */
  async getOrdersByOPPId(oppId, filters = {}) {
    // Используем готовый метод из BasicOrderModel
    const basicOrderModel = new BasicOrderModel();
    let orders = await basicOrderModel.findByOppId(oppId);

    // Применяем фильтр по статусу, если указан
    if (filters.status) {
      orders = orders.filter(order => order.current_status === filters.status);
    }

    const oppResult = await Database.query(
      'SELECT address FROM opp WHERE opp_id = $1',
      [oppId]
    );
    const pickupAddress = oppResult.rows[0]?.address || '';

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const products = await basicOrderModel.getOrderProducts(order.order_id);
        const total = await basicOrderModel.calculateTotal(order.order_id);

        return {
          order_id: order.order_id,
          total_sum: Number(total || 0).toFixed(2),
          status: order.current_status || 'waiting',
          created_at: order.created_date,
          seller_name: '',
          pickup_address: pickupAddress,
          products: products.map((product) => ({
            product_id: product.product_id,
            name: product.name,
            photo: this._firstPhoto(product.photos),
            quantity: product.ordered_count,
            price: String(product.price)
          }))
        };
      })
    );

    return ordersWithDetails;
  }

  /**
   * Получить статистику ПВЗ
   * @param {number} oppId - ID ПВЗ
   * @returns {Promise<Object>} - статистика
   */
  async getOPPStatistics(oppId) {
    // Получаем все заказы для данного ПВЗ
    const ordersResult = await Database.query(`
      SELECT DISTINCT o.order_id, op.product_id, op.ordered_count
      FROM orders o
      JOIN order_products op ON o.order_id = op.order_id
      WHERE o.opp_id = $1
    `, [oppId]);

    console.log(`[OPPModel.getOPPStatistics] oppId=${oppId}, found ${ordersResult.rows.length} order products`);

    if (ordersResult.rows.length === 0) {
      // Проверяем, есть ли вообще заказы в системе
      const allOrdersResult = await Database.query(`
        SELECT o.order_id, o.opp_id
        FROM orders o
        LIMIT 5
      `);
      console.log(`[OPPModel.getOPPStatistics] All orders sample:`, allOrdersResult.rows);

      return {
        total_orders: "0",
        completed_orders: "0",
        active_orders: "0",
        canceled_orders: "0"
      };
    }

    const orderIds = [...new Set(ordersResult.rows.map(r => r.order_id))];
    let completedOrders = 0;
    let canceledOrders = 0;
    let activeOrders = 0;

    // Для каждого заказа анализируем статусы товаров
    for (const orderId of orderIds) {
      const orderProducts = ordersResult.rows.filter(r => r.order_id === orderId);

      let allDelivered = true;
      let allRefunded = true;
      let hasAnyActivity = false;

      for (const product of orderProducts) {
        const statusInfo = await ordersService.getProductStatuses(product.product_id, orderId);
        const distribution = statusInfo.data.current_distribution;

        const deliveredCount = distribution.delivered || 0;
        const refundedCount = distribution.refunded || 0;
        const orderedCount = product.ordered_count;

        // Если хотя бы один товар не полностью выдан, заказ не completed
        if (deliveredCount < orderedCount) {
          allDelivered = false;
        }

        // Если хотя бы один товар не полностью возвращен, заказ не canceled
        if (refundedCount < orderedCount) {
          allRefunded = false;
        }

        // Проверяем, есть ли какая-то активность
        if (deliveredCount > 0 || refundedCount > 0 ||
            distribution.at_start_opp > 0 || distribution.at_target_opp > 0 ||
            Object.keys(distribution.sent_to_logistics).length > 0) {
          hasAnyActivity = true;
        }
      }

      // Определяем статус заказа
      if (allDelivered) {
        completedOrders++;
      } else if (allRefunded) {
        canceledOrders++;
      } else if (hasAnyActivity) {
        activeOrders++;
      }
    }

    return {
      total_orders: orderIds.length.toString(),
      completed_orders: completedOrders.toString(),
      active_orders: activeOrders.toString(),
      canceled_orders: canceledOrders.toString()
    };
  }

  /**
   * Получить логистические заказы для ПВЗ
   * Фильтрует in-memory хранилище outerLogisticsService
   * @param {number} oppId - ID ПВЗ
   * @param {string} direction - 'incoming' | 'outgoing' | 'all'
   * @returns {Array} - массив логистических заказов
   */
  getLogisticsOrdersByOPPId(oppId, direction = 'all') {
    const result = [];

    // Напрямую читаем из _logisticsOrders сервиса
    for (const [logisticsOrderId, order] of Object.entries(OuterLogisticsService._logisticsOrders)) {
      let shouldInclude = false;

      if (direction === 'all') {
        shouldInclude = order.sourceOppId === oppId || order.targetOppId === oppId;
      } else if (direction === 'outgoing') {
        shouldInclude = order.sourceOppId === oppId;
      } else if (direction === 'incoming') {
        shouldInclude = order.targetOppId === oppId;
      }

      if (shouldInclude) {
        result.push({
          logistics_order_id: parseInt(logisticsOrderId),
          source_opp_id: order.sourceOppId,
          target_opp_id: order.targetOppId,
          created_date: order.createdDate,
          products_count: order.products.length,
          total_items: order.products.reduce((sum, p) => sum + p.count, 0),
          products: order.products
        });
      }
    }

    return result;
  }
}

export default new OPPModel();
