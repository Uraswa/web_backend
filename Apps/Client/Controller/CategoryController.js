import CategoryModel from "../Model/CategoryModel.js";

class CategoryController {

    async getAllCategories(req, res) {
        try {
            const categories = await CategoryModel.findAll();

            return res.status(200).json({
                success: true,
                data: { categories }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении категорий'
            });
        }
    }

    async getFilters(req, res) {
        try {
            const {category_id} = req.query;
            const filters = await CategoryModel.getFilters(category_id);

            return res.status(200).json({
                success: true,
                data: filters
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении фильтров'
            });
        }
    }

    async getCharacteristicNames(req, res) {
        try {
            const {ids} = req.query;
            if (!ids) {
                return res.status(400).json({
                    success: false,
                    error: 'ids are required'
                });
            }

            const rawIds = ids.split(',').map((value) => value.trim()).filter(Boolean);
            const parsedIds = rawIds.map((value) => Number(value));
            if (parsedIds.length === 0 || parsedIds.some((value) => !Number.isInteger(value))) {
                return res.status(400).json({
                    success: false,
                    error: 'ids must be a comma-separated list of integers'
                });
            }

            const uniqueIds = [...new Set(parsedIds)];
            const rows = await CategoryModel.getCharacteristicNamesByIds(uniqueIds);
            const names = {};
            for (const row of rows) {
                names[row.characteristic_id] = row.name;
            }

            return res.status(200).json({
                success: true,
                data: names
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении названий характеристик'
            });
        }
    }
}

export default new CategoryController();
