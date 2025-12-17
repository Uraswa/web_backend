import OPPModel from '../Model/OPPModel.js';
import ordersService from '../../../Core/Services/ordersService.js';

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
