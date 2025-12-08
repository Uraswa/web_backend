import CartController from './Controller/CartController.js';
export default (router) => {

// Корзина
    // Корзина
    router.get('/cart', CartController.getCart);
    router.get('/cart/info', CartController.getCartInfo);
    router.post('/cart/add/:productId', CartController.addToCart);
    router.put('/cart/update/:productId', CartController.updateCartItem);
    router.delete('/cart/remove/:productId', CartController.removeFromCart);
    router.delete('/cart/clear', CartController.clearCart);
}