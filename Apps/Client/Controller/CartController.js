import CartService from "../../../Core/Services/cartService.js";
import ProductModel from "../Model/ProductModel.js";

class CartController {

    // Получение корзины
    async getCart(req, res) {
        try {
            const user = req.user;

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

    async updateCart(req, res) {
        try {
            const user = req.user;
            const {productId} = req.params;
            const {quantity = 1} = req.body;

            const product = await ProductModel.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: "product_not_found"
                });
            }

            const cart = await CartService.updateCartItem(user.user_id, productId, parseInt(quantity));
            return res.status(200).json({
                success: true,
                data: cart
            });


        } catch (e) {
            res.status(500).json({
                success: false,
                error: 'Ошибка при изменении корзины'
            });
        }
    }

    // Очистка корзины
    async clearCart(req, res) {
        try {
            const user = req.user;

            const result = await CartService.clearCart(user.user_id);

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error(error);

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