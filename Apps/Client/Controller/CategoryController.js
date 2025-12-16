import CategoryModel from "../Model/CategoryModel.js";

class CategoryController {

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
}

export default new CategoryController();