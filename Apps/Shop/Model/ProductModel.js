import BasicProductModel from "../../../Core/Model/BasicProductModel.js";
import {Database} from "../../../Core/Model/Database.js";

class ProductModel extends BasicProductModel {
    constructor() {
        super();
    }

    // Получить список товаров (фильтр по названию) (для страницы список товаров)
    async getProductListByName(searchTerm = '', limit = 20) {
        if (searchTerm) {
            return await this.searchByName(searchTerm, limit);
        } else {
            const query = `
                SELECT p.*, pc.name AS category_name, s.name AS shop_name
                FROM ${this.tableName} p
                JOIN product_categories pc ON p.category_id = pc.category_id
                JOIN shops s ON p.shop_id = s.shop_id
                ORDER BY p.created_at DESC
                LIMIT $1
            `;
            const result = await Database.query(query, [limit]);
            return result.rows;
        }
    }

    // Удалить товар (для страницы список товаров)
    async delete(productId) {
        const query = `DELETE FROM ${this.tableName} WHERE product_id = $1`;
        const result = await Database.query(query, [productId]);
        return result.rowCount > 0;
    }

    // Обновление товара (для страницы редактирования)
    async updateProduct(productId, { categoryId, name, description, photos, price }) {
    const query = `
        UPDATE ${this.tableName}
        SET category_id = $1,
            name = $2,
            description = $3,
            photos = $4,
            price = $5
        WHERE product_id = $6
        RETURNING *
    `;
    const result = await Database.query(query, [categoryId, name, description, photos, price, productId]);
    return result.rows[0];
}


    // Добавление нового товара (для страницы добавления товара)
    async addProduct({ categoryId, shopId, name, description, photos, price }) {
        const query = `
            INSERT INTO ${this.tableName} (category_id, shop_id, name, description, photos, price)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await Database.query(query, [categoryId, shopId, name, description, photos, price]);
        return result.rows[0];
    }
}


export default new ProductModel();