import BasicProductModel from "../../../Core/Model/BasicProductModel.js";
import { Database } from "../../../Core/Model/Database.js";

class ProductModel extends BasicProductModel {
    constructor() {
        super();
    }

    async findWithFilters(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT p.*, pc.name as category_name, s.name as shop_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE 1=1
        `;

        const values = [];
        let paramCount = 1;

        // Фильтр по категории
        if (filters.category_id) {
            query += ` AND p.category_id = $${paramCount}`;
            values.push(filters.category_id);
            paramCount++;
        }

        // Фильтр по магазину
        if (filters.shop_id) {
            query += ` AND p.shop_id = $${paramCount}`;
            values.push(filters.shop_id);
            paramCount++;
        }

        // Фильтр по цене (мин)
        if (filters.min_price) {
            query += ` AND p.price >= $${paramCount}`;
            values.push(filters.min_price);
            paramCount++;
        }

        // Фильтр по цене (макс)
        if (filters.max_price) {
            query += ` AND p.price <= $${paramCount}`;
            values.push(filters.max_price);
            paramCount++;
        }

        // Поиск по названию
        if (filters.search) {
            query += ` AND p.name ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }

        // Сортировка
        const orderBy = filters.order_by || 'created_at';
        const orderDirection = filters.order_direction === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY p.${orderBy} ${orderDirection}`;

        // Пагинация
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await Database.query(query, values);
        return result.rows;
    }

    async countWithFilters(filters = {}) {
        let query = `SELECT COUNT(*) FROM ${this.tableName} p WHERE 1=1`;
        const values = [];
        let paramCount = 1;

        if (filters.category_id) {
            query += ` AND p.category_id = $${paramCount}`;
            values.push(filters.category_id);
            paramCount++;
        }

        if (filters.shop_id) {
            query += ` AND p.shop_id = $${paramCount}`;
            values.push(filters.shop_id);
            paramCount++;
        }

        if (filters.min_price) {
            query += ` AND p.price >= $${paramCount}`;
            values.push(filters.min_price);
            paramCount++;
        }

        if (filters.max_price) {
            query += ` AND p.price <= $${paramCount}`;
            values.push(filters.max_price);
            paramCount++;
        }

        if (filters.search) {
            query += ` AND p.name ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }

        const result = await Database.query(query, values);
        return parseInt(result.rows[0].count);
    }

    async getPopularProducts(limit = 20) {
        const query = `
            SELECT p.*, COUNT(op.product_id) as order_count
            FROM ${this.tableName} p
            LEFT JOIN order_products op ON p.product_id = op.product_id
            GROUP BY p.product_id
            ORDER BY order_count DESC, p.created_at DESC
            LIMIT $1
        `;
        const result = await Database.query(query, [limit]);
        return result.rows;
    }
}

export default new ProductModel();