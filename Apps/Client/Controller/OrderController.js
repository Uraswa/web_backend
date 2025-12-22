import OrderModel from "../Model/OrderModel.js";
import CartService from "../../../Core/Services/cartService.js";
import ordersService from "../../../Core/Services/ordersService.js";

class OrderController {

    // Создание заказа из корзины
    async createOrder(req, res) {
        try {
            const user = req.user;
            const { opp_id } = req.body;

            if (!opp_id) {
                return res.status(400).json({
                    success: false,
                    error: 'ppo_not_defined'
                });
            }

            // Получаем товары из корзины
            const {cart, changes} = await CartService.ValidateProductCounts(user.user_id);

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'cart_empty'
                });
            }

            if (changes && changes.length !== 0) {
                return res.status(200).json({
                    success: false,
                    error: 'products_count_changed',
                    data: {
                        cart: cart
                    }
                });
            }

            // Подготавливаем данные для заказа
            const orderItems = cart.items.map(item => ({
                product_id: item.product_id,
                count: item.quantity
            }));

            const order = await ordersService.createOrder(user.user_id, opp_id, orderItems);

            // Очищаем корзину после создания заказа
            await CartService.clearCart(user.user_id);

            return res.status(200).json({
                success: true,
                data: {
                    order_id: order.order_id,
                    message: 'Заказ успешно создан',
                    cart_cleared: true
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при создании заказа'
            });
        }
    }

    async cancelOrder(req, res){
        try {
            const user = req.user;
            const { order_id } = req.body;

            if (!order_id) {
                return res.status(404).json({
                    success: false,
                    error: 'order_not_found'
                });
            }

            const order = await OrderModel.findById(order_id);
            if (!order || order.receiver_id !== user.user_id) {
                return res.status(404).json({
                    success: false,
                    error: 'order_not_found'
                });
            }

            let cancelOrderResult = await ordersService.cancelOrder(order_id);
            return res.status(200).json({
                success: cancelOrderResult.success
            });


        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при отмене заказа'
            });
        }
    }

    // Получение списка заказов пользователя
    async getUserOrders(req, res) {
        try {
            const user = req.user;

            const orders = await OrderModel.findByUserId(user.user_id);

            // Добавляем информацию о товарах для каждого заказа
            const ordersWithDetails = await Promise.all(
                orders.map(async (order) => {
                    const products = await OrderModel.getOrderProducts(order.order_id);
                    const total = await OrderModel.calculateTotal(order.order_id);
                    const statusHistory = await ordersService.getOrderStatusHistory(order.order_id);

                    return {
                        ...order,
                        products,
                        total: parseFloat(total).toFixed(2),
                        current_status: statusHistory.length !== 0 ? statusHistory[statusHistory.length - 1].name : null,
                        last_status_date: statusHistory.length !== 0 ? statusHistory[statusHistory.length - 1].time : null,
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: ordersWithDetails
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении заказов'
            });
        }
    }

    // Получение деталей заказа
    async getOrderDetails(req, res) {
        try {
            const user = req.user;
            const { orderId } = req.params;

            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'order_not_found'
                });
            }

            // Проверяем, что заказ принадлежит пользователю
            if (order.receiver_id !== user.user_id) {
                return res.status(403).json({
                    success: false,
                    error: 'access_denied'
                });
            }

            const orderDetails = await OrderModel.getOrderSummary(orderId);

            // Получаем историю статусов заказа
            const statusHistory = await ordersService.getOrderStatusHistory(orderId);

            return res.status(200).json({
                success: true,
                data: {
                    ...orderDetails,
                    current_status: statusHistory.length !== 0 ? statusHistory[statusHistory.length - 1].name : null,
                    status_history: statusHistory
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении заказа'
            });
        }
    }

    // Страница "Заказ сделан"
    async orderSuccess(req, res) {
        try {
            const user = req.user;
            const { orderId } = req.params;

            const order = await OrderModel.findById(orderId);

            if (!order || order.receiver_id != user.user_id) {
                return res.status(404).json({
                    success: false,
                    error: 'order_not_found'
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    message: 'Заказ успешно создан!',
                    order_id: order.order_id,
                    delivery_point: order.address
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении информации о заказе'
            });
        }
    }
}

export default new OrderController();