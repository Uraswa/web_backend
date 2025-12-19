import OrderModel from "../models/OrderModel.js";

class OrderController {
    // Список заказов продавца с ПВЗ и товарами
    async listByShop(req, res) {
        try {
            const shopId = parseInt(req.params.shopId);
            const orders = await OrderModel.getOrdersByShop(shopId);
            res.json(orders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка получения заказов' });
        }
    }
}

export default new OrderController();