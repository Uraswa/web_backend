import { Database } from './Database.js';

export default class BasicProductCategoryModel {
    constructor() {
        this.tableName = 'product_categories';
    }

    async findById(categoryId) {
        const query = `SELECT * FROM ${this.tableName} WHERE category_id = $1`;
        const result = await Database.query(query, [categoryId]);
        return result.rows[0] || null;
    }

    async findAll() {
        const query = `SELECT * FROM ${this.tableName} ORDER BY name`;
        const result = await Database.query(query);
        return result.rows;
    }

    async findByParentId(parentCategoryId) {
        const query = `SELECT * FROM ${this.tableName} WHERE parent_category_id = $1 ORDER BY name`;
        const result = await Database.query(query, [parentCategoryId]);
        return result.rows;
    }
}
