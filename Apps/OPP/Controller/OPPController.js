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
     * Выдать заказ клиенту (сменить статус на done)
     * PUT /api/opp/orders/:id/issue
     */
    async issueOrder(req, res) {
        try {
            const order_id = req.params.id;
            const user_id = req.user.user_id;

            // Выдаём заказ
            const updatedOrder = await OPPModel.issueOrder(order_id, user_id);

            return res.status(200).json({
                success: true,
                data: {
                    order_id: updatedOrder.order_id,
                    received_date: updatedOrder.received_date,
                    message: 'Заказ успешно выдан'
                }
            });

        } catch (error) {
            console.error('Error in issueOrder:', error);

            // Обрабатываем специфичные ошибки
            if (error.message.includes('статусом') || error.message.includes('не найден')) {
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