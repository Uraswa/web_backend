import { Database } from './Database.js';

export default class BasicPPOModel {
    constructor() {
        this.tableName = 'opp';
    }

    async findById(oppId) {
        const query = `SELECT * FROM ${this.tableName} WHERE opp_id = $1`;
        const result = await Database.query(query, [oppId]);
        return result.rows[0] || null;
    }

    async findAllEnabled() {
        const query = `SELECT * FROM ${this.tableName} WHERE enabled = true ORDER BY address`;
        const result = await Database.query(query);
        return result.rows;
    }

    async findAll() {
        const query = `SELECT * FROM ${this.tableName} ORDER BY address`;
        const result = await Database.query(query);
        return result.rows;
    }

    async findByLocation(latitude, longitude, radiusKm = 10) {
        const query = `
            SELECT *, 
                   SQRT(POWER(latitude - $1, 2) + POWER(longitude - $2, 2)) as distance
            FROM ${this.tableName} 
            WHERE enabled = true
            HAVING SQRT(POWER(latitude - $1, 2) + POWER(longitude - $2, 2)) * 111 <= $3
            ORDER BY distance
            LIMIT 20
        `;
        const result = await Database.query(query, [latitude, longitude, radiusKm]);
        return result.rows;
    }

    async create(oppData) {
        const query = `
            INSERT INTO ${this.tableName} (address, latitude, longitude, enabled, work_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const result = await Database.query(query, [
            oppData.address,
            oppData.latitude,
            oppData.longitude,
            oppData.enabled !== undefined ? oppData.enabled : true,
            oppData.work_time
        ], true);
        return result.rows[0];
    }

    async update(oppId, updateData) {
        const allowedFields = ['address', 'latitude', 'longitude', 'enabled', 'work_time'];
        const setClause = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                setClause.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (setClause.length === 0) {
            return await this.findById(oppId);
        }

        values.push(oppId);
        const query = `
            UPDATE ${this.tableName} 
            SET ${setClause.join(', ')} 
            WHERE opp_id = $${paramCount}
            RETURNING *
        `;
        const result = await Database.query(query, values, true);
        return result.rows[0] || null;
    }

    async delete(oppId) {
        const query = `DELETE FROM ${this.tableName} WHERE opp_id = $1 RETURNING *`;
        const result = await Database.query(query, [oppId], true);
        return result.rows[0] || null;
    }
}
