import CartService from "../../../Core/Services/cartService.js";

class CartController {

    // Получение корзины
    async getCart(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const cart = await CartService.getCartWithDetails(user.user_id);

            return res.status(200).json({
                success: true,
                data: cart
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении корзины'
            });
        }
    }

    // Добавление в корзину
    async addToCart(req, res) {
        try {
            const user = req.user;
            const { productId } = req.params;
            const { quantity = 1 } = req.body;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const cart = await CartService.addToCart(user.user_id, productId, parseInt(quantity));

            return res.status(200).json({
                success: true,
                data: cart
            });
        } catch (error) {
            console.error(error);

            if (error.message === 'Товар не найден') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Ошибка при добавлении в корзину'
            });
        }
    }

    // Обновление количества товара в корзине
    async updateCartItem(req, res) {
        try {
            const user = req.user;
            const { productId } = req.params;
            const { quantity } = req.body;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            if (!quantity || quantity < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Количество должно быть не менее 0'
                });
            }

            const cart = await CartService.updateCartItem(user.user_id, productId, parseInt(quantity));

            return res.status(200).json({
                success: true,
                data: cart
            });
        } catch (error) {
            console.error(error);

            if (error.message === 'Корзина не найдена' || error.message === 'Товар не найден в корзине') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Ошибка при обновлении корзины'
            });
        }
    }

    // Удаление из корзины
    async removeFromCart(req, res) {
        try {
            const user = req.user;
            const { productId } = req.params;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const cart = await CartService.removeFromCart(user.user_id, productId);

            return res.status(200).json({
                success: true,
                data: cart
            });
        } catch (error) {
            console.error(error);

            if (error.message === 'Корзина не найдена' || error.message === 'Товар не найден в корзине') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Ошибка при удалении из корзины'
            });
        }
    }

    // Очистка корзины
    async clearCart(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const result = await CartService.clearCart(user.user_id);

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error(error);

            if (error.message === 'Корзина не найдена') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Ошибка при очистке корзины'
            });
        }
    }

    // Получение информации о корзине (без деталей)
    async getCartInfo(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const cartInfo = await CartService.getCartInfo(user.user_id);

            return res.status(200).json({
                success: true,
                data: cartInfo
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении информации о корзине'
            });
        }
    }
}

export default new CartController();