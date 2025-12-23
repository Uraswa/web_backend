import BasicProductModel from "../../../Core/Model/BasicProductModel.js";
import { Database } from "../../../Core/Model/Database.js";

class ProductModel extends BasicProductModel {
    constructor() {
        super();
    }

    // Получить список товаров (фильтр по названию) (для страницы список товаров)
    async getProductListByOwnerId(ownerId, searchTerm = '', limit = 20) {
        if (searchTerm) {
            const query = `
                SELECT p.*, pc.name AS category_name, s.name AS shop_name
                FROM ${this.tableName} p
                JOIN product_categories pc ON p.category_id = pc.category_id
                JOIN shops s ON p.shop_id = s.shop_id
                WHERE s.owner_id = $1 AND p.name ILIKE $2
                ORDER BY p.created_at DESC
                LIMIT $3
            `;
            const result = await Database.query(query, [ownerId, `%${searchTerm}%`, limit]);
            return result.rows;
        }

        const query = `
            SELECT p.*, pc.name AS category_name, s.name AS shop_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE s.owner_id = $1
            ORDER BY p.created_at DESC
            LIMIT $2
        `;
        const result = await Database.query(query, [ownerId, limit]);
        return result.rows;
    }

    async getOwnerIdByProductId(productId) {
        const query = `
            SELECT s.owner_id
            FROM ${this.tableName} p
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE p.product_id = $1
        `;
        const result = await Database.query(query, [productId]);
        return result.rows[0]?.owner_id ?? null;
    }

    // Удалить товар (для страницы список товаров)
    async delete(productId) {
        const query = `DELETE FROM ${this.tableName} WHERE product_id = $1`;
        const result = await Database.query(query, [productId]);
        return result.rowCount > 0;
    }

    // Добавление нового товара или товара в группу вариантов
    async addProduct({ categoryId, shopId, name, description, photos, price, characteristics = {}, variantGroupId = null, stockChange = 0 }) {
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
                (category_id, shop_id, name, description, photos, price, characteristics, variant_group_id, count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, GREATEST($9, 0))
            RETURNING *
        `;
        try {
            const result = await Database.query(query, [
                categoryId,
                shopId,
                name,
                description,
                photos,
                price,
                JSON.stringify(characteristics),
                variantGroupId,
                stockChange
            ], true);

            // ВАЖНО: products.variant_group_id — FK на product_variants.variant_group_id.
            // Если variantGroupId не передан, оставляем NULL (обычный товар без группы вариантов).
            return result.rows[0];
        } catch (error) {
            // FK violation (например, если передали несуществующий variantGroupId)
            if (error?.code === '23503') {
                throw new Error('Некорректная группа вариантов (variantGroupId)');
            }
            throw error;
        }
    }

// Обновление товара с проверкой уникальности комбинации в группе вариантов
    async updateProduct(productId, { categoryId, name, description, photos, price, characteristics = {}, variantGroupId = null, stockChange = 0 }) {
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

        // Обновляем товар с изменением остатков
        const query = `
            UPDATE ${this.tableName}
            SET category_id = $1,
                name = $2,
                description = $3,
                photos = $4,
                price = $5,
                characteristics = $6,
                variant_group_id = $7,
                count = GREATEST(count + $8, 0)
            WHERE product_id = $9
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
            stockChange,
            productId
        ], true);

        return result.rows[0];
    }


    // Получить товар по ID
    async getById(productId) {
        return await this.findById(productId);
    }
}

export default new ProductModel();
