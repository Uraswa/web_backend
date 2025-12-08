import BasicFeedbackModel from "../../../Core/Model/BasicFeedbackModel.js";
import { Database } from "../../../Core/Model/Database.js";

class FeedbackModel extends BasicFeedbackModel {
    constructor() {
        super();
    }

    async create(userId, productId, feedbackData) {
        const client = await Database.GetMasterClient();
        try {
            await client.query('BEGIN');

            const query = `
                INSERT INTO ${this.tableName} 
                (user_id, product_id, rate, good_text, bad_text, comment)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await client.query(query, [
                userId,
                productId,
                feedbackData.rate,
                feedbackData.good_text || null,
                feedbackData.bad_text || null,
                feedbackData.comment || null
            ]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async update(userId, productId, feedbackData) {
        const client = await Database.GetMasterClient();
        try {
            await client.query('BEGIN');

            const query = `
                UPDATE ${this.tableName} 
                SET rate = $1, 
                    good_text = $2, 
                    bad_text = $3, 
                    comment = $4
                WHERE user_id = $5 AND product_id = $6
                RETURNING *
            `;

            const result = await client.query(query, [
                feedbackData.rate,
                feedbackData.good_text || null,
                feedbackData.bad_text || null,
                feedbackData.comment || null,
                userId,
                productId
            ]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async delete(userId, productId) {
        const query = `
            DELETE FROM ${this.tableName} 
            WHERE user_id = $1 AND product_id = $2
            RETURNING *
        `;
        const result = await Database.query(query, [userId, productId], true);
        return result.rows[0] || null;
    }
}

export default new FeedbackModel();