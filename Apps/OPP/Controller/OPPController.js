import OPPModel from '../Model/OPPModel.js';
import ordersService from '../../../Core/Services/ordersService.js';
import { Database } from '../../../Core/Model/Database.js';

async function getProductRemainingCount(orderId, productId) {
  const productResult = await Database.query(
    `SELECT ordered_count
     FROM order_products
     WHERE order_id = $1 AND product_id = $2`,
    [orderId, productId]
  );

  if (productResult.rows.length === 0) {
    return 0;
  }

  const orderedCount = Number(productResult.rows[0].ordered_count);

  const deliveredResult = await Database.query(
    `SELECT COALESCE(SUM(count), 0) AS delivered
     FROM order_product_statuses
     WHERE order_id = $1 AND product_id = $2 AND order_product_status = 'delivered'`,
    [orderId, productId]
  );

  const refundedResult = await Database.query(
    `SELECT COALESCE(SUM(count), 0) AS refunded
     FROM order_product_statuses
     WHERE order_id = $1 AND product_id = $2 AND order_product_status = 'refunded'`,
    [orderId, productId]
  );

  const remaining = orderedCount
    - Number(deliveredResult.rows[0].delivered || 0)
    - Number(refundedResult.rows[0].refunded || 0);

  return Math.max(0, remaining);
}

async function validateRejectedProductsRequest(orderId, oppId, rejectedProducts = []) {
  if (!Array.isArray(rejectedProducts) || rejectedProducts.length === 0) {
    return { valid: true };
  }

  const usageMap = new Map();
  const remainingCache = new Map();

  for (const product of rejectedProducts) {
    if (!product || typeof product.product_id === 'undefined' || typeof product.count === 'undefined') {
      return { valid: false, status: 400, error: 'invalid_rejected_product' };
    }

    const productId = Number(product.product_id);
    const count = Number(product.count);

    if (!Number.isInteger(productId) || !Number.isInteger(count) || count <= 0) {
      return { valid: false, status: 400, error: 'invalid_rejected_product' };
    }

    if (!remainingCache.has(productId)) {
      const remaining = await getProductRemainingCount(orderId, productId);
      remainingCache.set(productId, remaining);
    }

    const available = remainingCache.get(productId);
    const alreadyRequested = usageMap.get(productId) || 0;
    const totalRequested = alreadyRequested + count;

    if (totalRequested > available) {
      return {
        valid: false,
        status: 400,
        error: 'rejected_count_exceeds_available',
        meta: {
          product_id: productId,
          requested: totalRequested,
          available
        }
      };
    }

    usageMap.set(productId, totalRequested);
  }

  return { valid: true };
}

class OPPController {

  /**
   * Получить список заказов ПВЗ
   */
  async getOPPOrders(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);
      const filters = {
        status: req.query.status
      };

      const orders = await OPPModel.getOrdersByOPPId(oppId, filters);

      return res.status(200).json({
        success: true,
        data: {
          orders,
          count: orders.length
        }
      });
    } catch (error) {
      console.error('Error in getOPPOrders:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении списка заказов'
      });
    }
  }

  /**
   * Получить список логистических заказов
   */
  async getOPPLogisticsOrders(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);
      const direction = req.query.direction || 'all'; // 'incoming' | 'outgoing' | 'all'

      // Используем метод из OPPModel (который читает из outerLogisticsService)
      const logisticsOrders = OPPModel.getLogisticsOrdersByOPPId(oppId, direction);

      return res.status(200).json({
        success: true,
        data: {
          logistics_orders: logisticsOrders,
          count: logisticsOrders.length,
          direction
        }
      });
    } catch (error) {
      console.error('Error in getOPPLogisticsOrders:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении логистических заказов'
      });
    }
  }

  /**
   * Получить статистику ПВЗ
   */
  async getOPPStatistics(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);

      const statistics = await OPPModel.getOPPStatistics(oppId);

      return res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error in getOPPStatistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении статистики'
      });
    }
  }

  /**
   * Выдать заказ клиенту
   */
  async deliverOrderToClient(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);
      const { order_id, rejected_products } = req.body;

      if (!order_id) {
        return res.status(400).json({
          success: false,
          error: 'order_id_required'
        });
      }

      if (Array.isArray(rejected_products) && rejected_products.length > 0) {
        const validation = await validateRejectedProductsRequest(order_id, oppId, rejected_products);

        if (!validation.valid) {
          return res.status(validation.status || 400).json({
            success: false,
            error: validation.error,
            ...(validation.meta ? { meta: validation.meta } : {})
          });
        }
      }

      // Вызвать метод из ordersService
      const result = await ordersService.deliverOrder(
        order_id,
        oppId,
        rejected_products || []
      );

      return res.status(200).json(result);

    } catch (error) {
      console.error('Error in deliverOrderToClient:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при выдаче заказа'
      });
    }
  }

  /**
   * Принять товар от продавца
   */
  async receiveFromSeller(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);
      const { order_id, product_id, count } = req.body;

      if (!order_id || !product_id || !count) {
        return res.status(400).json({
          success: false,
          error: 'missing_required_fields'
        });
      }

      const result = await ordersService.orderReceiveProduct(
        order_id,
        product_id,
        count,
        oppId
      );

      return res.status(200).json(result);

    } catch (error) {
      console.error('Error in receiveFromSeller:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при приеме товара от продавца'
      });
    }
  }

  /**
   * Передать товар логисту
   */
  async giveToLogistics(req, res) {
    try {
      const oppId = parseInt(req.params.oppId);
      const { order_id, logistics_order_id, product_id, count } = req.body;

      if (!order_id || !logistics_order_id || !product_id || !count) {
        return res.status(400).json({
          success: false,
          error: 'missing_required_fields'
        });
      }

      const result = await ordersService.giveProductToDelivery(
        order_id,
        logistics_order_id,
        product_id,
        count,
        oppId
      );

      return res.status(200).json(result);

    } catch (error) {
      console.error('Error in giveToLogistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при передаче товара логисту'
      });
    }
  }

  /**
   * Принять товар от логиста
   */
  async receiveFromLogistics(req, res) {
    try {
      const { logistics_order_id } = req.body;

      if (!logistics_order_id) {
        return res.status(400).json({
          success: false,
          error: 'logistics_order_id_required'
        });
      }

      const result = await ordersService.receiveProductFromLogistics(logistics_order_id);

      return res.status(200).json(result);

    } catch (error) {
      console.error('Error in receiveFromLogistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при приеме товара от логиста'
      });
    }
  }

  /**
   * Получить детали заказа
   */
  async getOrderDetails(req, res) {
    try {
      const { orderId } = req.params;

      const orderDetails = await ordersService.getOrderWithDetails(parseInt(orderId));

      if (!orderDetails) {
        return res.status(404).json({
          success: false,
          error: 'order_not_found'
        });
      }

      return res.status(200).json({
        success: true,
        data: orderDetails
      });

    } catch (error) {
      console.error('Error in getOrderDetails:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении деталей заказа'
      });
    }
  }
}

export default new OPPController();
