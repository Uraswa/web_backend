import ProductModel from "../Model/ProductModel.js";

class ProductController {
    // Список товаров с фильтром по названию
    async getListProductByFilter(req, res) {
        try {
            const searchTerm = req.query.search || '';
            const products = await ProductModel.getProductListByName(searchTerm);
            res.json(products);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка получения списка товаров' });
        }
    }

    // Получить товар для редактирования
    async get(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const product = await ProductModel.getById(productId);
            if (!product) return res.status(404).json({ error: 'Товар не найден' });
            res.json(product);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка получения товара' });
        }
    }

    // Добавление нового товара
    async create(req, res) {
        try {
            const data = req.body;
            const newProduct = await ProductModel.addProduct(data);
            res.status(201).json(newProduct);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка создания товара' });
        }
    }

    // Обновление товара
    async update(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const data = req.body;
            const updatedProduct = await ProductModel.updateProduct(productId, data);
            if (!updatedProduct) return res.status(404).json({ error: 'Товар не найден' });
            res.json(updatedProduct);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка обновления товара' });
        }
    }

    // Удаление товара
    async delete(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const success = await ProductModel.delete(productId);
            if (!success) return res.status(404).json({ error: 'Товар не найден' });
            res.json({ message: 'Товар удалён' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка удаления товара' });
        }
    }
}

export default new ProductController();
