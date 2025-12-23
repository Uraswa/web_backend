import ProductController from './Controller/ProductController.js';
import ShopController from './Controller/ShopController.js';
import OrderController from './Controller/OrderController.js';
import CategoryController from './Controller/CategoryController.js';
import authMiddleware from "../../Core/Middleware/authMiddleware.js";
import {
    requireProductOwnerFromParams,
    requireSellerOrderOwnerFromParams,
    requireShopOwnerFromBody,
    requireShopOwnerFromParams
} from "./Middleware/ownershipMiddleware.js";

export default (router) => {
// Товары

    // Список товаров с фильтром по названию
    router.get('/api/products', authMiddleware, ProductController.getListProductByFilter);

    // Получить товар по ID (seller-версия без конфликта с Client API)
    router.get('/api/seller/products/:id', authMiddleware, requireProductOwnerFromParams('id'), ProductController.get);

    // Получить товар по ID (для редактирования)
    router.get('/api/products/:id', authMiddleware, requireProductOwnerFromParams('id'), ProductController.get);

    // Добавление нового товара
    router.post('/api/products', authMiddleware, requireShopOwnerFromBody(), ProductController.create.bind(ProductController));

    // Редактирование товара
    router.put('/api/products/:id', authMiddleware, requireProductOwnerFromParams('id'), ProductController.update.bind(ProductController));

    // Удаление товара
    router.delete('/api/products/:id', authMiddleware, requireProductOwnerFromParams('id'), ProductController.delete);

// Заказы

    // Список заказов продавца с информацией о ПВЗ
    router.get('/api/orders/shop/:shopId', authMiddleware, requireShopOwnerFromParams('shopId'), OrderController.listByShop);

    // Детали заказа продавца (только его товары в заказе)
    router.get('/api/seller/orders/:orderId', authMiddleware, requireSellerOrderOwnerFromParams('orderId'), OrderController.getSellerOrderDetails);

// Магазин

    // Получить магазины для редактирования
    router.get('/api/shops/:id', authMiddleware, requireShopOwnerFromParams('id'), ShopController.get);

    // Редактирование магазина
    router.put('/api/shops/:id', authMiddleware, requireShopOwnerFromParams('id'), ShopController.update);

    router.get('/api/shops', authMiddleware, ShopController.listByOwner);

// Категории

    // Получить характеристики категории по ID
    router.get('/api/categories/:categoryId/characteristics', authMiddleware, CategoryController.getCharacteristics);

    // Получить информацию о категории
    router.get('/api/categories/:categoryId', authMiddleware, CategoryController.get);
}
