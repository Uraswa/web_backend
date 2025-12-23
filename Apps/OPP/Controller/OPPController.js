import OPPModel from '../Model/OPPModel.js';
import ordersService from '../../../Core/Services/ordersService.js';
import { Database } from '../../../Core/Model/Database.js';

function firstPhoto(photos) {
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
   * Получить доступные статусы заказов для ПВЗ (по данным БД)
   */
  async getOPPOrderStatuses(req, res) {
    try {
      const oppId = Number.parseInt(req.params.oppId, 10);
      if (!Number.isInteger(oppId)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_opp_id'
        });
      }

      const result = await Database.query(
        `
          SELECT DISTINCT os.status
          FROM orders o
          JOIN (
            SELECT DISTINCT ON (order_id) order_id, status
            FROM order_statuses
            ORDER BY order_id, date DESC
          ) os ON os.order_id = o.order_id
          WHERE o.opp_id = $1
            AND os.status IS NOT NULL
        `,
        [oppId]
      );

      const preferredOrder = ['packing', 'shipping', 'waiting', 'done', 'canceled'];
      const statuses = result.rows
        .map((row) => row.status)
        .filter(Boolean)
        .sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));

      return res.status(200).json({
        success: true,
        data: {
          statuses
        }
      });
    } catch (error) {
      console.error('Error in getOPPOrderStatuses:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении статусов заказов'
      });
    }
  }

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
   * Получить ПВЗ владельца
   */
  async getUserOpp(req, res) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }

      const oppResult = await Database.query(
        `SELECT opp_id, address, enabled
         FROM opp
         WHERE owner_id = $1
         ORDER BY opp_id`,
        [userId]
      );

      if (oppResult.rows.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            opp_id: null,
            opps: []
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          opp_id: oppResult.rows[0].opp_id,
          opps: oppResult.rows
        }
      });
    } catch (error) {
      console.error('Error in getUserOpp:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении ПВЗ'
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
      const { oppId, orderId } = req.params;
      const parsedOppId = Number.parseInt(oppId, 10);
      const parsedOrderId = Number.parseInt(orderId, 10);

      const orderDetails = await ordersService.getOrderWithDetails(parsedOrderId);

      const orderOppId = orderDetails ? Number.parseInt(String(orderDetails.opp_id), 10) : NaN;
      if (!orderDetails || !Number.isInteger(orderOppId) || orderOppId !== parsedOppId) {
        return res.status(404).json({
          success: false,
          error: 'order_not_found'
        });
      }

      const statusResult = await Database.query(
        `SELECT status, date, data
         FROM order_statuses
         WHERE order_id = $1
         ORDER BY date DESC`,
        [parsedOrderId]
      );

      const currentStatus = statusResult.rows[0]?.status || 'waiting';
      const statusHistory = statusResult.rows.map((row) => ({
        status: row.status,
        timestamp: row.date,
        comment: row.data?.comment || row.data?.reason
      }));

      const buyerName = [orderDetails.first_name, orderDetails.last_name].filter(Boolean).join(' ');

      const dto = {
        order_id: orderDetails.order_id,
        total_sum: String(orderDetails.total ?? '0.00'),
        status: currentStatus,
        created_at: orderDetails.created_date,
        seller_name: '',
        pickup_address: orderDetails.address || '',
        products: (orderDetails.products || []).map((product) => ({
          product_id: product.product_id,
          name: product.name,
          photo: firstPhoto(product.photos),
          quantity: product.ordered_count,
          price: String(product.price)
        })),
        buyer_name: buyerName,
        buyer_phone: '',
        status_history: statusHistory
      };

      return res.status(200).json({
        success: true,
        data: dto
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
