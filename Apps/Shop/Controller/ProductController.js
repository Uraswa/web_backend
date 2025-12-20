import ProductModel from "../Model/ProductModel.js";

class ProductController {
    // Список товаров с фильтром по названию
    async getListProductByFilter(req, res) {
        try {
            const searchTerm = req.query.search || '';
            const products = await ProductModel.getProductListByName(searchTerm);
            res.json({ success: true, data: products });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка получения списка товаров' });
        }
    }

    // Получить товар для редактирования
    async get(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const product = await ProductModel.getById(productId);
            if (!product) return res.status(404).json({ success: false, error: 'Товар не найден' });
            res.json({ success: true, data: product });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка получения товара' });
        }
    }

    // Добавление нового товара или товара в группу вариантов
    async create(req, res) {
        try {
            const data = req.body;
            // data может содержать variantGroupId и characteristics
            const newProduct = await ProductModel.addProduct(data);
            res.status(201).json({ success: true, data: newProduct });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message || 'Ошибка создания товара' });
        }
    }

    // Обновление товара (с проверкой уникальности комбинации характеристик в группе)
    async update(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const data = req.body; // data содержит характеристики и опционально variantGroupId
            const updatedProduct = await ProductModel.updateProduct(productId, data);
            res.json({ success: true, data: updatedProduct });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message || 'Ошибка обновления товара' });
        }
    }

    // Удаление товара
    async delete(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const success = await ProductModel.delete(productId);
            if (!success) return res.status(404).json({ success: false, error: 'Товар не найден' });
            res.json({ success: true, message: 'Товар удалён' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка удаления товара' });
        }
    }

    // Получить фильтровые характеристики категории
    async getCategoryCharacteristics(req, res) {
        try {
            const categoryId = parseInt(req.params.categoryId);
            const characteristics = await ProductModel.getCategoryCharacteristics(categoryId);
            res.json({ success: true, data: characteristics });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка получения характеристик категории' });
        }
    }

    // Сохранение характеристик товара (отдельный эндпоинт)
    async saveCharacteristics(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const characteristics = req.body;
            const updatedProduct = await ProductModel.updateProduct(productId, { characteristics });
            res.json({ success: true, data: updatedProduct });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка сохранения характеристик' });
        }
    }
}

export default new ProductController();
