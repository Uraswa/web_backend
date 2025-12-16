import ProductController from './Controller/ProductController.js';
import FeedbackController from './Controller/FeedbackController.js';
import CartController from './Controller/CartController.js';
import OrderController from './Controller/OrderController.js';
import CarouselController from './Controller/CarouselController.js';

export default (router) => {


// Главная страница
    router.get('/products/popular', ProductController.getPopularProducts);

// Поиск товаров (страница результатов поиска)
    router.get('/products/search', ProductController.searchProducts);

// Товары по категории
    router.get('/products/category/:categoryId', ProductController.getProductsByCategory);

// Страница товара
    router.get('/products/:id', ProductController.getProductById);

// Отзывы
    router.post('/products/:productId/feedback', FeedbackController.addFeedback);
    router.delete('/products/:productId/feedback', FeedbackController.deleteFeedback);
    router.get('/user/feedback', FeedbackController.getUserFeedback);

// Корзина
    // Корзина
    router.get('/cart', CartController.getCart);
    router.get('/cart/info', CartController.getCartInfo);
    router.post('/cart/add/:productId', CartController.addToCart);
    router.put('/cart/update/:productId', CartController.updateCartItem);
    router.delete('/cart/remove/:productId', CartController.removeFromCart);
    router.delete('/cart/clear', CartController.clearCart);

// Заказы
    router.post('/orders/create', OrderController.createOrder);
    router.get('/orders', OrderController.getUserOrders);
    router.get('/orders/:orderId', OrderController.getOrderDetails);
    router.get('/orders/success/:orderId', OrderController.orderSuccess);

// Рекламная карусель
    router.get('/carousel/slides', CarouselController.getSlides);
}
