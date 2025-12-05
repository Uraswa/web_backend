import { Database } from './Database.js';

export default class BasicProductModel {
    constructor() {
        this.tableName = 'products';
    }

    async findById(productId) {
        const query = `
            SELECT p.*, pc.name as category_name, s.name as shop_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE p.product_id = $1
        `;
        const result = await Database.query(query, [productId]);
        return result.rows[0] || null;
    }

    async findByShopId(shopId) {
        const query = `
            SELECT p.*, pc.name as category_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            WHERE p.shop_id = $1
            ORDER BY p.created_at DESC
        `;
        const result = await Database.query(query, [shopId]);
        return result.rows;
    }

    async findByCategoryId(categoryId) {
        const query = `
            SELECT p.*, pc.name as category_name, s.name as shop_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE p.category_id = $1
            ORDER BY p.created_at DESC
        `;
        const result = await Database.query(query, [categoryId]);
        return result.rows;
    }

    async searchByName(searchTerm, limit = 50) {
        const query = `
            SELECT p.*, pc.name as category_name, s.name as shop_name
            FROM ${this.tableName} p
            JOIN product_categories pc ON p.category_id = pc.category_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE p.name ILIKE $1
            ORDER BY p.created_at DESC
            LIMIT $2
        `;
        const result = await Database.query(query, [`%${searchTerm}%`, limit]);
        return result.rows;
    }
}
