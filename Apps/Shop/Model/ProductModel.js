import BasicProductModel from "../../../Core/Model/BasicProductModel.js";
import { Database } from "../../../Core/Model/Database.js";

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

    // Добавление нового товара или товара в группу вариантов
    async addProduct({ categoryId, shopId, name, description, photos, price, characteristics = {}, variantGroupId = null }) {
        // Если это товар в группе вариантов, проверяем уникальность комбинации
        if (variantGroupId) {
            const existing = await Database.query(
                `SELECT product_id, characteristics FROM ${this.tableName} WHERE variant_group_id = $1`,
                [variantGroupId]
            );
            const duplicate = existing.rows.find(p => JSON.stringify(p.characteristics) === JSON.stringify(characteristics));
            if (duplicate) {
                throw new Error('Эта комбинация вариантов уже существует в группе');
            }
        }

        // Вставляем новый товар
        const query = `
            INSERT INTO ${this.tableName} 
                (category_id, shop_id, name, description, photos, price, characteristics, variant_group_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await Database.query(query, [
            categoryId,
            shopId,
            name,
            description,
            photos,
            price,
            JSON.stringify(characteristics),
            variantGroupId
        ]);

        // Если это новая группа вариантов и variantGroupId не задан, используем ID первого товара как variant_group_id
        if (!variantGroupId) {
            const newProduct = result.rows[0];
            await Database.query(
                `UPDATE ${this.tableName} SET variant_group_id = $1 WHERE product_id = $1`,
                [newProduct.product_id]
            );
            newProduct.variant_group_id = newProduct.product_id;
        }

        return result.rows[0];
    }

// Обновление товара с проверкой уникальности комбинации в группе вариантов
    async updateProduct(productId, { categoryId, name, description, photos, price, characteristics = {}, variantGroupId = null }) {
        // Получаем текущий товар
        const product = await this.getById(productId);
        if (!product) throw new Error('Товар не найден');

        // Определяем группу вариантов
        const groupId = variantGroupId || product.variant_group_id;

        // Проверка уникальности комбинации в группе
        if (groupId) {
            const groupProducts = await Database.query(
                `SELECT product_id, characteristics FROM ${this.tableName} WHERE variant_group_id = $1`,
                [groupId]
            );
            const isDuplicate = groupProducts.rows.some(p =>
                p.product_id !== productId && JSON.stringify(p.characteristics) === JSON.stringify(characteristics)
            );
            if (isDuplicate) {
                throw new Error('Эта комбинация вариантов уже существует в группе');
            }
        }

        // Обновляем товар
        const query = `
            UPDATE ${this.tableName}
            SET category_id = $1,
                name = $2,
                description = $3,
                photos = $4,
                price = $5,
                characteristics = $6,
                variant_group_id = $7
            WHERE product_id = $8
            RETURNING *
        `;
        const result = await Database.query(query, [
            categoryId,
            name,
            description,
            photos,
            price,
            JSON.stringify(characteristics),
            groupId,
            productId
        ]);

        return result.rows[0];
    }


    // Получить товар по ID
    async getById(productId) {
        return await this.findById(productId);
    }

    // Получить фильтровые характеристики категории
    async getCategoryCharacteristics(categoryId) {
        const query = `
            SELECT *
            FROM category_characteristics
            WHERE category_id = $1
            ORDER BY allow_in_filter DESC, name
        `;
        const result = await Database.query(query, [categoryId]);
        return result.rows;
    }
}

export default new ProductModel();