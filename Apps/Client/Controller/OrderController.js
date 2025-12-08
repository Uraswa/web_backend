import OrderModel from "../Model/OrderModel.js";
import CartService from "../../../Core/Services/cartService.js";

class OrderController {

    // Создание заказа из корзины
    async createOrder(req, res) {
        try {
            const user = req.user;
            const { opp_id } = req.body;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            if (!opp_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указан пункт выдачи'
                });
            }

            // Получаем товары из корзины
            const cart = await CartService.getCartWithDetails(user.user_id);

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Корзина пуста'
                });
            }

            // Подготавливаем данные для заказа
            const orderItems = cart.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.product.price
            }));

            // Создаем заказ
            const order = await OrderModel.createFromCart(user.user_id, opp_id, orderItems);

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

    // Получение списка заказов пользователя
    async getUserOrders(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const orders = await OrderModel.findByUserId(user.user_id);

            // Добавляем информацию о товарах для каждого заказа
            const ordersWithDetails = await Promise.all(
                orders.map(async (order) => {
                    const products = await OrderModel.getOrderProducts(order.order_id);
                    const total = await OrderModel.calculateTotal(order.order_id);

                    return {
                        ...order,
                        products,
                        total: parseFloat(total).toFixed(2)
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

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Заказ не найден'
                });
            }

            // Проверяем, что заказ принадлежит пользователю
            if (order.receiver_id !== user.user_id) {
                return res.status(403).json({
                    success: false,
                    error: 'Доступ запрещен'
                });
            }

            const orderDetails = await OrderModel.getOrderSummary(orderId);

            return res.status(200).json({
                success: true,
                data: orderDetails
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
            const { orderId } = req.params;

            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Заказ не найден'
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    message: 'Заказ успешно создан!',
                    order_id: order.order_id,
                    status: order.current_status,
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