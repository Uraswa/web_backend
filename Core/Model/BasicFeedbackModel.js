import { Database } from './Database.js';

export default class BasicFeedbackModel {
    constructor() {
        this.tableName = 'feedback';
    }

    async findByProductId(productId) {
        const query = `
            SELECT f.*, up.first_name, up.last_name
            FROM ${this.tableName} f
            JOIN user_profiles up ON f.user_id = up.user_id
            WHERE f.product_id = $1
            ORDER BY f.created_at DESC
        `;
        const result = await Database.query(query, [productId]);
        return result.rows;
    }

    async findByUserId(userId) {
        const query = `
            SELECT f.*, p.name as product_name
            FROM ${this.tableName} f
            JOIN products p ON f.product_id = p.product_id
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `;
        const result = await Database.query(query, [userId]);
        return result.rows;
    }

    async findByUserAndProduct(userId, productId) {
        const query = `SELECT * FROM ${this.tableName} WHERE user_id = $1 AND product_id = $2`;
        const result = await Database.query(query, [userId, productId]);
        return result.rows[0] || null;
    }

    async getProductRating(productId) {
        const query = `
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rate) as average_rating
            FROM ${this.tableName} 
            WHERE product_id = $1
        `;
        const result = await Database.query(query, [productId]);
        return result.rows[0];
    }
}
