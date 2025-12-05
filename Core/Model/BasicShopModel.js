import { Database } from './Database.js';

export default class BasicShopModel {
    constructor() {
        this.tableName = 'shops';
    }

    async findById(shopId) {
        const query = `SELECT * FROM ${this.tableName} WHERE shop_id = $1`;
        const result = await Database.query(query, [shopId]);
        return result.rows[0] || null;
    }

    async findByOwnerId(ownerId) {
        const query = `SELECT * FROM ${this.tableName} WHERE owner_id = $1 ORDER BY name`;
        const result = await Database.query(query, [ownerId]);
        return result.rows;
    }

    async findAll() {
        const query = `SELECT * FROM ${this.tableName} ORDER BY name`;
        const result = await Database.query(query);
        return result.rows;
    }
}
