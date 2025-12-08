import ProductController from './Controller/ProductController.js';
import CartController from './Controller/CartController.js';
export default (router) => {


// Главная страница
    router.get('/products/popular', ProductController.getPopularProducts);

// Поиск товаров (страница результатов поиска)
    router.get('/products/search', ProductController.searchProducts);

// Товары по категории
    router.get('/products/category/:categoryId', ProductController.getProductsByCategory);

// Страница товара
    router.get('/products/:id', ProductController.getProductById);
// Корзина
    // Корзина
    router.get('/cart', CartController.getCart);
    router.get('/cart/info', CartController.getCartInfo);
    router.post('/cart/add/:productId', CartController.addToCart);
    router.put('/cart/update/:productId', CartController.updateCartItem);
    router.delete('/cart/remove/:productId', CartController.removeFromCart);
    router.delete('/cart/clear', CartController.clearCart);
}