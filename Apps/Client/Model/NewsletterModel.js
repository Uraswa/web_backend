import { Database } from "../../../Core/Model/Database.js";

class NewsletterModel {
    async upsertSubscription(email) {
        const query = `
            INSERT INTO newsletter_subscriptions (email)
            VALUES ($1)
            ON CONFLICT (email)
            DO UPDATE SET
                is_active = true,
                unsubscribed_at = NULL
            RETURNING *
        `;
        const result = await Database.query(query, [email]);
        return result.rows[0];
    }

    async unsubscribe(email) {
        const query = `
            UPDATE newsletter_subscriptions
            SET is_active = false,
                unsubscribed_at = NOW()
            WHERE email = $1
            RETURNING *
        `;
        const result = await Database.query(query, [email]);
        return result.rows[0] || null;
    }
}

export default new NewsletterModel();
