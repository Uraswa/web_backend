import BasicPPOModel from "../../../Core/Model/BasicPPOModel.js";
import { Database } from "../../../Core/Model/Database.js";

class OppAdminModel extends BasicPPOModel {
    constructor() {
        super();
    }

    // Список ПВЗ с владельцем, опциональный поиск по адресу
    async findAllWithOwner(search) {
        const params = [];
        let where = "WHERE 1=1";

        if (search) {
            params.push(`%${search}%`);
            where += ` AND o.address ILIKE $${params.length}`;
        }

        const query = `
            SELECT
                o.opp_id,
                o.address,
                o.latitude,
                o.longitude,
                o.enabled,
                o.work_time,
                o.owner_id,
                ul.email,
                up.first_name,
                up.last_name
            FROM ${this.tableName} o
            LEFT JOIN user_login_info ul ON ul.user_id = o.owner_id
            LEFT JOIN user_profiles up ON up.user_id = o.owner_id
            ${where}
            ORDER BY o.opp_id DESC
        `;

        const result = await Database.query(query, params);
        return result.rows;
    }

    // Создание ПВЗ
    async createOpp({ address, latitude, longitude, enabled = true, work_time, owner_id }) {
        const query = `
            INSERT INTO ${this.tableName} (address, latitude, longitude, enabled, work_time, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [address, latitude, longitude, enabled, work_time || null, owner_id || null];
        const result = await Database.query(query, values, true);
        return result.rows[0];
    }

    // Обновление ПВЗ
    async updateOpp(opp_id, { address, latitude, longitude, enabled, work_time, owner_id }) {
        const query = `
            UPDATE ${this.tableName}
            SET address = $1,
                latitude = $2,
                longitude = $3,
                enabled = $4,
                work_time = $5,
                owner_id = $6
            WHERE opp_id = $7
            RETURNING *
        `;
        const values = [address, latitude, longitude, enabled, work_time || null, owner_id || null, opp_id];
        const result = await Database.query(query, values, true);
        return result.rows[0];
    }

    // Удаление ПВЗ
    async deleteOpp(opp_id) {
        const query = `
            DELETE FROM ${this.tableName}
            WHERE opp_id = $1
            RETURNING opp_id
        `;
        const result = await Database.query(query, [opp_id], true);
        return result.rows[0];
    }
}

export default new OppAdminModel();
