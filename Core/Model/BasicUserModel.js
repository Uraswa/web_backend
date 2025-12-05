import { Database } from './Database.js';

export default class BasicUserModel {
    constructor() {
        this.tableName = 'users';
        this.loginInfoTable = 'user_login_info';
        this.profileTable = 'user_profiles';
    }

    async getUserById(user_id) {
        const query = `SELECT *
                       FROM users
                       WHERE user_id = $1`;
        const result = await Database.query(query, [user_id]);
        return result.rows[0];
    }

    async getUserByEmail(email) {
        const query = `SELECT u.user_id, u.is_activated
                       FROM user_login_info ul
                                JOIN users u on u.user_id = ul.user_id
                       WHERE ul.email = $1`
        const result = await Database.query(query, [email]);
        return result.rows[0]
    }
}
