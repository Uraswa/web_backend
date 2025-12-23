import CategoryModel from "../Model/CategoryModel.js";

class CategoryController {
    /**
     * Получить характеристики категории по ID
     * Возвращает список характеристик с их типами, названиями и метаданными
     */
    async getCharacteristics(req, res) {
        try {
            const categoryId = parseInt(req.params.categoryId);

            if (!categoryId || isNaN(categoryId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Некорректный ID категории'
                });
            }

            const characteristics = await CategoryModel.getCharacteristics(categoryId);

            res.json({
                success: true,
                data: characteristics
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                success: false,
                error: 'Ошибка получения характеристик категории'
            });
        }
    }

    /**
     * Получить информацию о категории
     */
    async get(req, res) {
        try {
            const categoryId = parseInt(req.params.categoryId);

            if (!categoryId || isNaN(categoryId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Некорректный ID категории'
                });
            }

            const category = await CategoryModel.getById(categoryId);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Категория не найдена'
                });
            }

            res.json({
                success: true,
                data: category
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                success: false,
                error: 'Ошибка получения категории'
            });
        }
    }
}

export default new CategoryController();
