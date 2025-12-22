import ProductController from './Controller/ProductController.js';
import FeedbackController from './Controller/FeedbackController.js';
import CartController from './Controller/CartController.js';
import OrderController from './Controller/OrderController.js';
import authMiddleware from "../../Core/Middleware/authMiddleware.js";
import CategoryController from "./Controller/CategoryController.js";
import CarouselController from './Controller/CarouselController.js';
import OppController from './Controller/OppController.js';

export default (router) => {


// Главная страница
    router.get('/api/products/popular', ProductController.getPopularProducts);

// Поиск товаров (страница результатов поиска)
    router.get('/api/products/search', ProductController.searchProducts);

// Товары по категории
    router.get('/api/products/category/:categoryId', ProductController.getProductsByCategory);

// Страница товара
    router.get('/api/products/:id', ProductController.getProductById);

// Отзывы
    router.post('/api/products/:productId/feedback', authMiddleware, FeedbackController.addFeedback);
    router.delete('/api/products/:productId/feedback', authMiddleware, FeedbackController.deleteFeedback);
    router.get('/api/user/feedback', authMiddleware, FeedbackController.getUserFeedback);

    // Корзина
    router.get('/api/cart', authMiddleware, CartController.getCart);
    router.get('/api/cart/info', authMiddleware, CartController.getCartInfo);
    router.put('/api/cart/update/:productId', authMiddleware, CartController.updateCart);
    router.delete('/api/cart/clear', authMiddleware, CartController.clearCart);

// Заказы
    router.post('/api/orders/create', authMiddleware, OrderController.createOrder);
    router.get('/api/orders', authMiddleware, OrderController.getUserOrders);
    router.get('/api/orders/:orderId', authMiddleware, OrderController.getOrderDetails);
    router.post('/api/orders/:orderId/cancel', authMiddleware, OrderController.cancelOrder);
    router.get('/api/orders/success/:orderId', authMiddleware, OrderController.orderSuccess);

//Категории
    router.get('/api/categories', CategoryController.getAllCategories);
    router.get('/api/categories/getFilters', CategoryController.getFilters);
    router.get('/api/characteristics/names', CategoryController.getCharacteristicNames);

// Рекламная карусель
    router.get('/carousel/slides', CarouselController.getSlides);

// ПВЗ (Пункты выдачи заказов)
    router.get('/api/opp/by-radius', OppController.GetOppsByRadius);
    router.get('/api/opp/:oppId', OppController.getOppById);
    router.get('/api/opp', OppController.getAllOpps);
}
