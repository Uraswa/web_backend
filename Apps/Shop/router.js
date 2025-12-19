import ProductController from './Controller/ProductController.js';
import ShopController from './Controller/ShopController.js';
import OrderController from './Controller/OrderController.js';
import authMiddleware from "../../Core/Middleware/authMiddleware.js";

export default (router) => {
// Товары

    // Список товаров с фильтром по названию
    router.get('/api/products', authMiddleware, ProductController.getListProductByFilter);

    // Получить товар по ID (для редактирования)
    router.get('/api/products/:id', authMiddleware, ProductController.get);

    // Добавление нового товара
    router.post('/api/products', authMiddleware, ProductController.create);

    // Редактирование товара
    router.put('/api/products/:id', authMiddleware, ProductController.update);

    // Удаление товара
    router.delete('/api/products/:id', authMiddleware, ProductController.delete);

// Заказы

    // Список заказов продавца с информацией о ПВЗ
    router.get('/api/orders/shop/:shopId', authMiddleware, OrderController.listByShop);

// Магазин

    // Получить магазин для редактирования
    router.get('/api/shops/:id', authMiddleware, ShopController.get);

    // Редактирование магазина
    router.put('/api/shops/:id', authMiddleware, ShopController.update);
}