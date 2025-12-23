import { Database } from "../../../Core/Model/Database.js";

class CategoryModel {
    constructor() {
        this.tableName = 'product_categories';
        this.characteristicsTable = 'category_characteristics';
    }

    /**
     * Получить характеристики категории по ID
     * @param {number} categoryId - ID категории
     * @returns {Promise<Array>} - Массив характеристик
     */
    async getCharacteristics(categoryId) {
        const query = `
            SELECT
                characteristic_id,
                category_id,
                name,
                type,
                data,
                allow_in_filter
            FROM ${this.characteristicsTable}
            WHERE category_id = $1
            ORDER BY allow_in_filter DESC, name ASC
        `;

        const result = await Database.query(query, [categoryId]);
        return result.rows;
    }

    /**
     * Получить информацию о категории
     * @param {number} categoryId - ID категории
     * @returns {Promise<Object|null>} - Объект категории или null
     */
    async getById(categoryId) {
        const query = `
            SELECT
                category_id,
                name,
                parent_category_id
            FROM ${this.tableName}
            WHERE category_id = $1
        `;

        const result = await Database.query(query, [categoryId]);
        return result.rows[0] || null;
    }
}

export default new CategoryModel();