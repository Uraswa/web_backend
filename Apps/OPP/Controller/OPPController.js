// Apps/OPP/Controller/OPPController.js

import OPPModel from '../Model/OPPModel.js';

class OPPController {

    /**
     * Получить информацию о своём ПВЗ
     * GET /api/opp/my-pvz
     */
    async getMyPVZ(req, res) {
        try {
            const user_id = req.user.user_id;

            const opp = await OPPModel.getOPPByOwnerId(user_id);

            if (!opp) {
                return res.status(404).json({
                    success: false,
                    error: 'ПВЗ не найден'
                });
            }

            return res.status(200).json({
                success: true,
                data: opp
            });

        } catch (error) {
            console.error('Error in getMyPVZ:', error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения информации о ПВЗ'
            });
        }
    }

    /**
     * Получить список всех заказов своего ПВЗ
     * GET /api/opp/orders
     */
    async getMyOrders(req, res) {
        try {
            const opp_id = req.user_opp.opp_id; // Получаем из middleware

            // Получаем заказы с деталями
            const orders = await OPPModel.getOrdersWithDetails(opp_id);

            return res.status(200).json({
                success: true,
                data: {
                    opp_id: opp_id,
                    opp_address: req.user_opp.address,
                    orders: orders
                }
            });

        } catch (error) {
            console.error('Error in getMyOrders:', error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения заказов'
            });
        }
    }

    /**
     * Выдать заказ клиенту
     * PUT /api/opp/orders/:id/issue
     *
     * Использует новую систему order_product_statuses:
     * - Проверяет что товары находятся в целевом ПВЗ
     * - Создает статусы 'delivered' для всех товаров
     * - Устанавливает order_status = 'completed' если все товары выданы
     */
    async issueOrder(req, res) {
        try {
            const order_id = parseInt(req.params.id);
            const user_id = req.user.user_id;
            const opp_id = req.user_opp.opp_id;

            // Выдаём заказ через OPPModel
            const result = await OPPModel.issueOrder(order_id, opp_id, user_id);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    order_id: order_id,
                    message: result.data.message,
                    is_completed: result.data.is_completed,
                    delivered_count: result.data.delivered_count,
                    total_ordered: result.data.total_ordered,
                    partial_delivery: result.data.partial_delivery || false
                }
            });

        } catch (error) {
            console.error('Error in issueOrder:', error);

            // Обрабатываем специфичные ошибки
            if (error.message.includes('ПВЗ') || error.message.includes('найден') || error.message.includes('Нет товаров')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Ошибка выдачи заказа'
            });
        }
    }
}

export default new OPPController();