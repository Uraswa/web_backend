import authMiddleware from "../../Core/Middleware/authMiddleware.js";
import adminMiddleware from "./Middleware/adminMiddleware.js";
import ShopController from "./Controller/ShopController.js";
import UserAdminController from "./Controller/UserAdminController.js";

export default (router) => {
    
    // Магазины (админ)
    router.get('/api/admin/shops', authMiddleware, adminMiddleware, ShopController.listShops);
    router.post('/api/admin/shops', authMiddleware, adminMiddleware, ShopController.createShop);
    router.delete('/api/admin/shops/:shopId', authMiddleware, adminMiddleware, ShopController.deleteShop);
    router.put('/api/admin/shops/:shopId', authMiddleware, adminMiddleware, ShopController.updateShop);

    // Активные пользователи (для выбора продавца)
    router.get('/api/admin/users/active', authMiddleware, adminMiddleware, UserAdminController.listActiveUsers);
}
