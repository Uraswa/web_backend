import ShopModel from "../Model/ShopModel.js";
import BasicUserModel from "../../../Core/Model/BasicUserModel.js";

const userModel = new BasicUserModel();

class ShopController {
    
    // Список магазинов (с поиском по названию)
    async listShops(req, res) {
        try {
            const { search } = req.query;
            const shops = await ShopModel.findAllWithOwner(search);

            return res.status(200).json({
                success: true,
                data: shops
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при получении магазинов"
            });
        }
    }

    // Создание магазина
    async createShop(req, res) {
        try {
            const { name, owner_id, description } = req.body;

            if (!name || !owner_id) {
                return res.status(400).json({
                    success: false,
                    error: "Название и владелец обязательны"
                });
            }

            const owner = await userModel.getUserById(owner_id);
            if (!owner || !owner.is_active || !owner.is_activated) {
                return res.status(404).json({
                    success: false,
                    error: "Пользователь не найден или не активен"
                });
            }

            const shop = await ShopModel.createShop({ name, owner_id, description });

            return res.status(200).json({
                success: true,
                data: shop
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при создании магазина"
            });
        }
    }

    // Редактирование магазина
    async updateShop(req, res) {
        try {
            const { shopId } = req.params;
            const { name, owner_id, description } = req.body;

            if (!shopId) {
                return res.status(400).json({
                    success: false,
                    error: "shopId обязателен"
                });
            }

            if (!name || !owner_id) {
                return res.status(400).json({
                    success: false,
                    error: "Название и владелец обязательны"
                });
            }

            const existing = await ShopModel.findById(shopId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: "Магазин не найден"
                });
            }

            const owner = await userModel.getUserById(owner_id);
            if (!owner || !owner.is_active || !owner.is_activated) {
                return res.status(404).json({
                    success: false,
                    error: "Пользователь не найден или не активен"
                });
            }

            const updated = await ShopModel.updateShop({
                shop_id: shopId,
                name,
                owner_id,
                description
            });

            return res.status(200).json({
                success: true,
                data: updated
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при обновлении магазина"
            });
        }
    }

    // Удаление магазина
    async deleteShop(req, res) {
        try {
            const { shopId } = req.params;

            if (!shopId) {
                return res.status(400).json({
                    success: false,
                    error: "shopId обязателен"
                });
            }

            const deleted = await ShopModel.deleteShop(shopId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: "Магазин не найден"
                });
            }

            return res.status(200).json({
                success: true,
                data: { shop_id: deleted.shop_id }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при удалении магазина"
            });
        }
    }
}

export default new ShopController();
