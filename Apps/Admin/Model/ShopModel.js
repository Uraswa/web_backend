import BasicShopModel from "../../../Core/Model/BasicShopModel.js";
import { Database } from "../../../Core/Model/Database.js";

class ShopModel extends BasicShopModel {
    constructor() {
        super();
    }

    // Возвращает список магазинов с владельцами, с опциональным поиском по названию
    async findAllWithOwner(search) {
        const params = [];
        let where = "WHERE 1=1";

        if (search) {
            params.push(`%${search}%`);
            where += ` AND s.name ILIKE $${params.length}`;
        }

        const query = `
            SELECT
                s.shop_id,
                s.name,
                s.description,
                s.owner_id,
                ul.email,
                up.first_name,
                up.last_name
            FROM ${this.tableName} s
            LEFT JOIN user_login_info ul ON ul.user_id = s.owner_id
            LEFT JOIN user_profiles up ON up.user_id = s.owner_id
            ${where}
            ORDER BY s.shop_id DESC
        `;

        const result = await Database.query(query, params);
        return result.rows;
    }

    // Создает магазин
    async createShop({ name, owner_id, description }) {
        const query = `
            INSERT INTO ${this.tableName} (name, owner_id, description)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const values = [name, owner_id, description || null];
        const result = await Database.query(query, values, true);
        return result.rows[0];
    }

    // Обновляет магазин
    async updateShop({ shop_id, name, owner_id, description }) {
        const query = `
            UPDATE ${this.tableName}
            SET name = $1,
                owner_id = $2,
                description = $3
            WHERE shop_id = $4
            RETURNING *
        `;
        const values = [name, owner_id, description || null, shop_id];
        const result = await Database.query(query, values, true);
        return result.rows[0];
    }

    // Удаляет магазин
    async deleteShop(shop_id) {
        const query = `
            DELETE FROM ${this.tableName}
            WHERE shop_id = $1
            RETURNING shop_id
        `;
        const result = await Database.query(query, [shop_id], true);
        return result.rows[0];
    }
}

export default new ShopModel();
