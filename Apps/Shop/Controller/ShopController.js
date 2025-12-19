import ShopModel from "../models/ShopModel.js";

class ShopController {
    // Получить магазин для редактирования
    async get(req, res) {
        try {
            const shopId = parseInt(req.params.id);
            const shop = await ShopModel.findById(shopId);
            if (!shop) return res.status(404).json({ error: 'Магазин не найден' });
            res.json(shop);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка получения магазина' });
        }
    }

    // Редактирование магазина
    async update(req, res) {
        try {
            const shopId = parseInt(req.params.id);
            const data = req.body;
            const updatedShop = await ShopModel.update(shopId, data);
            if (!updatedShop) return res.status(404).json({ error: 'Магазин не найден' });
            res.json(updatedShop);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка обновления магазина' });
        }
    }
}

export default new ShopController();
