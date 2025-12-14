import ProductModel from "../Model/ProductModel.js";
import FeedbackModel from "../Model/FeedbackModel.js";

class ProductController {

    // Главная страница - популярные товары
    async getPopularProducts(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 20;
            const products = await ProductModel.getPopularProducts(limit);

            return res.status(200).json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении товаров'
            });
        }
    }

    // Страница товара
    async getProductById(req, res) {
        try {
            const { id } = req.params;
            const product = await ProductModel.findByIdWithVariants(id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'not_found'
                });
            }

            // Получаем отзывы
            const feedback = await FeedbackModel.findByProductId(id);
            const rating = await FeedbackModel.getProductRating(id);

            return res.status(200).json({
                success: true,
                data: {
                    product,
                    feedback,
                    rating
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении товара'
            });
        }
    }

    // Поиск товаров
    async searchProducts(req, res) {
        try {
            const {
                search,
                category_id,
                shop_id,
                min_price,
                max_price,
                order_by = 'created_at',
                order_direction = 'desc',
                page = 1,
                limit = 20
            } = req.query;

            let {char_filters} = req.query;
            if (char_filters) {
                char_filters = JSON.parse(char_filters)
            } else {
                char_filters = [];
            }

            const filters = {
                search,
                category_id: category_id ? parseInt(category_id) : undefined,
                shop_id: shop_id ? parseInt(shop_id) : undefined,
                min_price: min_price ? parseFloat(min_price) : undefined,
                max_price: max_price ? parseFloat(max_price) : undefined,
                order_by,
                order_direction,
                char_filters
            };

            const offset = (page - 1) * limit;
            const products = await ProductModel.findWithFilters(filters, limit, offset);
            const total = await ProductModel.countWithFilters(filters);

            return res.status(200).json({
                success: true,
                data: {
                    products,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        total_pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при поиске товаров'
            });
        }
    }

    // Получение товаров по категории
    async getProductsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const filters = {
                category_id: parseInt(categoryId)
            };

            const offset = (page - 1) * limit;
            const products = await ProductModel.findWithFilters(filters, limit, offset);
            const total = await ProductModel.countWithFilters(filters);

            return res.status(200).json({
                success: true,
                data: {
                    products,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        total_pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении товаров'
            });
        }
    }
}

export default new ProductController();