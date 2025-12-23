import { Database } from './Database.js';

export default class BasicCarouselModel {
    constructor() {
        this.tableName = 'carousel_slides';
    }

    async getSlides(limit = 3) {
        const query = `
            SELECT
                slide_id AS id,
                type,
                title,
                description,
                button_text,
                button_link,
                image_url,
                slide_order AS "order"
            FROM ${this.tableName}
            ORDER BY slide_order ASC, slide_id ASC
            LIMIT $1
        `;
        const result = await Database.query(query, [limit]);
        return result.rows;
    }
}
