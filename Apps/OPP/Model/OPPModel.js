import BasicPPOModel from '../../../Core/Model/BasicPPOModel.js';
import BasicOrderModel from '../../../Core/Model/BasicOrderModel.js';
import { Database } from '../../../Core/Model/Database.js';
import ordersService from '../../../Core/Services/ordersService.js';
import OuterLogisticsService from '../../../Core/Services/outerLogisticsService.js';

class OPPModel extends BasicPPOModel {

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

    // Для каждого заказа добавляем детали товаров через ordersService
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const details = await ordersService.getOrderWithDetails(order.order_id);
        return details;
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
    const stats = await Database.query(`
      SELECT
        COUNT(DISTINCT o.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN os.status = 'done' THEN o.order_id END) as completed_orders,
        COUNT(DISTINCT CASE WHEN os.status IN ('packing', 'shipping', 'waiting') THEN o.order_id END) as active_orders,
        COUNT(DISTINCT CASE WHEN os.status = 'canceled' THEN o.order_id END) as canceled_orders
      FROM orders o
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, status
        FROM order_statuses
        ORDER BY order_id, date DESC
      ) os ON o.order_id = os.order_id
      WHERE o.opp_id = $1
    `, [oppId]);

    return stats.rows[0];
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
