import BasicUserModel from "../../../Core/Model/BasicUserModel.js";
import { Database } from "../../../Core/Model/Database.js";

class UserAdminModel extends BasicUserModel {
    constructor() {
        super();
    }

    // Возвращает активных пользователей, поддерживает поиск по email/имени
    async findActiveUsers(search) {
        const params = [];
        let where = `
            WHERE u.is_active = true
              AND u.is_activated = true
        `;

        if (search) {
            params.push(`%${search}%`);
            where += `
              AND (
                ul.email ILIKE $${params.length}
                OR up.first_name ILIKE $${params.length}
                OR up.last_name ILIKE $${params.length}
              )
            `;
        }

        const query = `
            SELECT
                u.user_id,
                ul.email,
                up.first_name,
                up.last_name
            FROM users u
            LEFT JOIN user_login_info ul ON ul.user_id = u.user_id
            LEFT JOIN user_profiles up ON up.user_id = u.user_id
            ${where}
            ORDER BY ul.email ASC
            LIMIT 50
        `;

        const result = await Database.query(query, params);
        return result.rows;
    }
}

export default new UserAdminModel();
